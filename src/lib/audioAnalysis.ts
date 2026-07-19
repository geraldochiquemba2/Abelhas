// ============================================================
// Audio Feature Extraction Engine — "Shazam-level" bee analysis
// Based on scientific literature on honeybee bioacoustics:
// - Keeling et al. (2008) "Tremble dances..."
// - Michelsen et al. (1986) "The honeybee waggle dance"
// - Tan et al. (2012) "Automated recognition of honeybee..."
// - Ramsey et al. (2020) "Hive-based acoustic monitoring"
// ============================================================

export interface AudioFeatures {
    duration: number;
    sampleRate: number;
    fftSize: number;

    // Spectral features
    spectralCentroid: number;
    spectralBandwidth: number;
    spectralRolloff: number;
    spectralFlatness: number;
    spectralFlux: number;

    // Time domain
    rmsEnergy: number;
    peakAmplitude: number;
    zeroCrossingRate: number;
    crestFactor: number;

    // MFCC (13 coefficients)
    mfcc: number[];

    // Frequency bands (scientific bee ranges)
    bands: {
        low50_150: number;     // Colony hum baseline
        mid150_350: number;    // Worker bee activity
        queen350_500: number;  // Queen piping/tooting
        absent500_1000: number;// Queen absent signal
        stress1000_3000: number;// Stress/piping high
        harmonic3000_8000: number;// Harmonics
    };

    // Beat/tempo
    bpm: number;
    beatConfidence: number;

    // Energy envelope
    attackTime: number;
    sustainLevel: number;

    // Modulation (waggle dance frequency)
    modulationRate: number;
    modulationDepth: number;

    // Raw magnitude spectrum for visualization
    magnitudeSpectrum: number[];
}

// --- FFT Implementation (Radix-2 Cooley-Tukey) ---
function fft(re: Float64Array, im: Float64Array) {
    const n = re.length;
    if (n === 0) return;
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
        if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
        let k = n >> 1;
        while (k <= j) { j -= k; k >>= 1; }
        j += k;
    }
    for (let len = 2; len <= n; len *= 2) {
        const half = len / 2;
        const angle = -2 * Math.PI / len;
        const wRe = Math.cos(angle);
        const wIm = Math.sin(angle);
        for (let i = 0; i < n; i += len) {
            let curRe = 1, curIm = 0;
            for (let k = 0; k < half; k++) {
                const tRe = curRe * re[i + k + half] - curIm * im[i + k + half];
                const tIm = curRe * im[i + k + half] + curIm * re[i + k + half];
                re[i + k + half] = re[i + k] - tRe;
                im[i + k + half] = im[i + k] - tIm;
                re[i + k] += tRe;
                im[i + k] += tIm;
                const newRe = curRe * wRe - curIm * wIm;
                curIm = curRe * wIm + curIm * wRe;
                curRe = newRe;
            }
        }
    }
}

// --- Mel filter bank ---
function hzToMel(hz: number): number { return 2595 * Math.log10(1 + hz / 700); }
function melToHz(mel: number): number { return 700 * (Math.pow(10, mel / 2595) - 1); }

function createMelFilterBank(numFilters: number, fftSize: number, sampleRate: number): number[][] {
    const lowMel = hzToMel(0);
    const highMel = hzToMel(sampleRate / 2);
    const melPoints = Array.from({ length: numFilters + 2 }, (_, i) =>
        melToHz(lowMel + (i / (numFilters + 1)) * (highMel - lowMel))
    );
    const binPoints = melPoints.map(f => Math.round(f / (sampleRate / fftSize) * fftSize / 2));

    const filters: number[][] = [];
    for (let i = 1; i <= numFilters; i++) {
        const filter = new Array(fftSize / 2 + 1).fill(0);
        const start = binPoints[i - 1];
        const center = binPoints[i];
        const end = binPoints[i + 1];

        for (let j = start; j < center; j++) {
            if (j < filter.length) filter[j] = (j - start) / (center - start || 1);
        }
        for (let j = center; j < end; j++) {
            if (j < filter.length) filter[j] = (end - j) / (end - center || 1);
        }
        filters.push(filter);
    }
    return filters;
}

// --- DCT Type II for MFCC ---
function dct(input: number[]): number[] {
    const n = input.length;
    const output = new Array(n).fill(0);
    for (let k = 0; k < n; k++) {
        for (let i = 0; i < n; i++) {
            output[k] += input[i] * Math.cos(Math.PI * k * (2 * i + 1) / (2 * n));
        }
    }
    return output;
}

// --- Hamming window ---
function hammingWindow(size: number): Float64Array {
    const window = new Float64Array(size);
    for (let i = 0; i < size; i++) {
        window[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (size - 1));
    }
    return window;
}

// --- Extract features from raw PCM samples ---
export function extractFeatures(samples: Float32Array, sampleRate: number): AudioFeatures {
    const duration = samples.length / sampleRate;
    const fftSize = 2048;
    const window = hammingWindow(fftSize);
    const numMfccCoeffs = 13;
    const melFilters = createMelFilterBank(26, fftSize, sampleRate);
    const magBins = fftSize / 2 + 1;

    // Accumulators
    let totalEnergy = 0;
    let peakAmp = 0;
    let zeroCrossings = 0;
    const allMagnitudes: number[][] = [];
    const mfccAccum = new Array(numMfccCoeffs).fill(0);
    let numFrames = 0;

    // Band accumulators
    let bandLow = 0, bandMid = 0, bandQueen = 0, bandAbsent = 0, bandStress = 0, bandHarmonic = 0;

    // Energy envelope for beat detection
    const energyEnvelope: number[] = [];
    const binWidth = sampleRate / fftSize;

    const hopSize = fftSize / 2;
    const re = new Float64Array(fftSize);
    const im = new Float64Array(fftSize);

    for (let pos = 0; pos + fftSize <= samples.length; pos += hopSize) {
        // Apply window
        for (let i = 0; i < fftSize; i++) {
            re[i] = samples[pos + i] * window[i];
            im[i] = 0;
        }

        // FFT
        fft(re, im);

        // Magnitude spectrum
        const magnitudes = new Array(magBins);
        let frameEnergy = 0;
        for (let i = 0; i < magBins; i++) {
            magnitudes[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
            frameEnergy += magnitudes[i] * magnitudes[i];
        }
        allMagnitudes.push(magnitudes);
        energyEnvelope.push(frameEnergy);
        totalEnergy += frameEnergy;

        const rms = Math.sqrt(frameEnergy / magBins);
        if (rms > peakAmp) peakAmp = rms;

        // Zero crossings
        for (let i = pos + 1; i < pos + fftSize && i < samples.length; i++) {
            if ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0)) {
                zeroCrossings++;
            }
        }

        // Mel filter bank energies
        const melEnergies: number[] = [];
        for (let m = 0; m < melFilters.length; m++) {
            let energy = 0;
            for (let k = 0; k < magBins; k++) {
                energy += magnitudes[k] * melFilters[m][k];
            }
            melEnergies.push(Math.log(Math.max(energy, 1e-10)));
        }

        // MFCC via DCT
        const mfccFrame = dct(melEnergies).slice(0, numMfccCoeffs);
        for (let c = 0; c < numMfccCoeffs; c++) {
            mfccAccum[c] += mfccFrame[c];
        }

        // Band energies (scientific bee frequency ranges)
        for (let i = 0; i < magBins; i++) {
            const freq = i * binWidth;
            const mag = magnitudes[i];
            if (freq >= 50 && freq < 150) bandLow += mag;
            else if (freq >= 150 && freq < 350) bandMid += mag;
            else if (freq >= 350 && freq < 500) bandQueen += mag;
            else if (freq >= 500 && freq < 1000) bandAbsent += mag;
            else if (freq >= 1000 && freq < 3000) bandStress += mag;
            else if (freq >= 3000 && freq < 8000) bandHarmonic += mag;
        }

        numFrames++;
    }

    // --- Spectral features ---
    // Average magnitude spectrum
    const avgMag = new Array(magBins).fill(0);
    for (const m of allMagnitudes) {
        for (let i = 0; i < magBins; i++) avgMag[i] += m[i];
    }
    for (let i = 0; i < magBins; i++) avgMag[i] /= numFrames;

    // Spectral centroid
    let weightedSum = 0, magSum = 0;
    for (let i = 0; i < magBins; i++) {
        weightedSum += i * avgMag[i];
        magSum += avgMag[i];
    }
    const spectralCentroid = magSum > 0 ? (weightedSum / magSum) * binWidth : 0;

    // Spectral bandwidth
    let bwSum = 0;
    for (let i = 0; i < magBins; i++) {
        bwSum += avgMag[i] * Math.pow(i * binWidth - spectralCentroid, 2);
    }
    const spectralBandwidth = magSum > 0 ? Math.sqrt(bwSum / magSum) : 0;

    // Spectral rolloff (85%)
    const rolloffThreshold = magSum * 0.85;
    let rolloffBin = magBins - 1;
    let cumSum = 0;
    for (let i = 0; i < magBins; i++) {
        cumSum += avgMag[i];
        if (cumSum >= rolloffThreshold) { rolloffBin = i; break; }
    }
    const spectralRolloff = rolloffBin * binWidth;

    // Spectral flatness (geometric mean / arithmetic mean)
    let logSum = 0;
    let linSum = 0;
    let count = 0;
    for (let i = 1; i < magBins; i++) {
        if (avgMag[i] > 0) {
            logSum += Math.log(avgMag[i]);
            linSum += avgMag[i];
            count++;
        }
    }
    const spectralFlatness = count > 0 ? Math.exp(logSum / count) / (linSum / count) : 0;

    // Spectral flux
    let flux = 0;
    for (let f = 1; f < allMagnitudes.length; f++) {
        let frameFlux = 0;
        for (let i = 0; i < magBins; i++) {
            const diff = allMagnitudes[f][i] - allMagnitudes[f - 1][i];
            if (diff > 0) frameFlux += diff * diff;
        }
        flux += Math.sqrt(frameFlux);
    }
    const spectralFlux = numFrames > 1 ? flux / (numFrames - 1) : 0;

    // --- Beat/BPM detection (energy onset) ---
    const bpm = detectBPM(energyEnvelope, sampleRate / hopSize);
    const beatConfidence = Math.min(1, energyEnvelope.length > 10 ? computeBeatConfidence(energyEnvelope) : 0);

    // --- MFCC averages ---
    const mfcc = mfccAccum.map(v => numFrames > 0 ? v / numFrames : 0);

    // --- Attack time (time to reach 90% of peak energy) ---
    const peakEnergy = Math.max(...energyEnvelope, 0.001);
    const attackThreshold = peakEnergy * 0.9;
    let attackFrame = energyEnvelope.findIndex(e => e >= attackThreshold);
    if (attackFrame < 0) attackFrame = energyEnvelope.length - 1;
    const attackTime = (attackFrame * hopSize) / sampleRate;

    // --- Sustain level (avg of last 25% frames) ---
    const sustainStart = Math.floor(energyEnvelope.length * 0.75);
    let sustainSum = 0;
    for (let i = sustainStart; i < energyEnvelope.length; i++) sustainSum += energyEnvelope[i];
    const sustainLevel = energyEnvelope.length > sustainStart
        ? sustainSum / (energyEnvelope.length - sustainStart) / (peakEnergy || 1) : 0;

    // --- Amplitude modulation (waggle dance detection) ---
    const { rate: modulationRate, depth: modulationDepth } = detectAmplitudeModulation(energyEnvelope, sampleRate / hopSize);

    // --- Normalize bands to 0-255 ---
    const maxBand = Math.max(bandLow, bandMid, bandQueen, bandAbsent, bandStress, bandHarmonic, 1);

    return {
        duration,
        sampleRate,
        fftSize,

        spectralCentroid,
        spectralBandwidth,
        spectralRolloff,
        spectralFlatness,
        spectralFlux,

        rmsEnergy: Math.sqrt(totalEnergy / (numFrames * magBins)),
        peakAmplitude: peakAmp,
        zeroCrossingRate: samples.length > 0 ? zeroCrossings / samples.length * sampleRate : 0,
        crestFactor: Math.sqrt(totalEnergy / (numFrames * magBins)) > 0
            ? peakAmp / Math.sqrt(totalEnergy / (numFrames * magBins)) : 0,

        mfcc,

        bands: {
            low50_150: Math.round(bandLow / maxBand * 255),
            mid150_350: Math.round(bandMid / maxBand * 255),
            queen350_500: Math.round(bandQueen / maxBand * 255),
            absent500_1000: Math.round(bandAbsent / maxBand * 255),
            stress1000_3000: Math.round(bandStress / maxBand * 255),
            harmonic3000_8000: Math.round(bandHarmonic / maxBand * 255),
        },

        bpm,
        beatConfidence,

        attackTime,
        sustainLevel,

        modulationRate,
        modulationDepth,

        magnitudeSpectrum: avgMag,
    };
}

// --- BPM detection via onset energy peaks ---
function detectBPM(energyEnvelope: number[], frameRate: number): number {
    if (energyEnvelope.length < 4) return 0;

    // Compute onset strength
    const onset = new Array(energyEnvelope.length).fill(0);
    for (let i = 1; i < energyEnvelope.length; i++) {
        const diff = energyEnvelope[i] - energyEnvelope[i - 1];
        onset[i] = diff > 0 ? diff : 0;
    }

    // Autocorrelation for tempo
    const minLag = Math.floor(frameRate * 60 / 200); // 200 BPM max
    const maxLag = Math.floor(frameRate * 60 / 40);  // 40 BPM min
    let bestLag = minLag;
    let bestCorr = -1;

    for (let lag = minLag; lag <= Math.min(maxLag, onset.length - 1); lag++) {
        let corr = 0;
        let count = 0;
        for (let i = 0; i < onset.length - lag; i++) {
            corr += onset[i] * onset[i + lag];
            count++;
        }
        corr /= count || 1;
        if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }

    return bestLag > 0 ? Math.round(frameRate * 60 / bestLag) : 0;
}

function computeBeatConfidence(energyEnvelope: number[]): number {
    if (energyEnvelope.length < 4) return 0;
    const mean = energyEnvelope.reduce((a, b) => a + b, 0) / energyEnvelope.length;
    const variance = energyEnvelope.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / energyEnvelope.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    return Math.min(1, cv * 3);
}

// --- Amplitude modulation detection (waggle dance ~13-15Hz) ---
function detectAmplitudeModulation(energyEnvelope: number[], frameRate: number): { rate: number; depth: number } {
    if (energyEnvelope.length < 16) return { rate: 0, depth: 0 };

    const mean = energyEnvelope.reduce((a, b) => a + b, 0) / energyEnvelope.length;
    if (mean === 0) return { rate: 0, depth: 0 };

    // Demean
    const signal = energyEnvelope.map(e => e - mean);

    // Autocorrelation
    const minLag = Math.floor(frameRate * 1 / 30); // 30 Hz max
    const maxLag = Math.floor(frameRate * 1 / 3);  // 3 Hz min
    let bestLag = minLag;
    let bestCorr = -1;

    for (let lag = minLag; lag <= Math.min(maxLag, signal.length - 1); lag++) {
        let corr = 0;
        for (let i = 0; i < signal.length - lag; i++) {
            corr += signal[i] * signal[i + lag];
        }
        if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }

    const rate = bestLag > 0 ? frameRate / bestLag : 0;
    const maxE = Math.max(...energyEnvelope);
    const minE = Math.min(...energyEnvelope);
    const depth = maxE + minE > 0 ? (maxE - minE) / (maxE + minE) : 0;

    return { rate, depth };
}
