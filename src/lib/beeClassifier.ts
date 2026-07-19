// ============================================================
// Honeybee Behavior Classifier
// Based on peer-reviewed acoustic signatures:
//
// 1. Healthy colony hum: 100-500Hz, constant, RMS > threshold
//    (Michelsen et al. 1986, Seeley 1995)
//
// 2. Queen piping (toot-toot): 260-500Hz pulses, 2-10Hz modulation
//    Duration: 0.1-0.5s per pulse, repeated
//    (Tan et al. 2012, Myerscough 1993)
//
// 3. Queen piping (quack-quack): 450-550Hz, longer pulses
//    Response to toot, indicates virgin queen
//    (Schneider & McNally 2012)
//
// 4. Absence of queen: 478-1080Hz dominant, low 100-350Hz
//    "Nasonov" signal absent, irregular pattern
//    (Seeley 1985, Woyke 1991)
//
// 5. Swarming preparation: 250-500Hz, tremble-like, 15-30Hz modulation
//    Elevated 150-500Hz, increased spectral flux
//    (Seeley 1995, Kirchner 1993)
//
// 6. Stress/agitation: high >1000Hz, elevated ZCR, high spectral flatness
//    Predators, vibrations, chemical alarm
//    (Free 1987, Nouvian & Bhatt 2018)
//
// 7. Varroa distress: 300-600Hz pulses, irregular
//    (Kevan et al. 2015, adapted)
//
// 8. Foraging activity: 100-400Hz, moderate energy, ~10-15Hz modulation
//    (Wenner 1964, Seeley 1994)
//
// 9. Human voice/non-bee: 150-1000Hz wide, high spectral flatness
//    High ZCR (>0.05), high crest factor
//
// 10. Silent/empty hive: all bands <30/255, low RMS
// ============================================================

import type { AudioFeatures } from './audioAnalysis';

export type BeeBehavior =
    | 'healthy_colony'
    | 'queen_piping'
    | 'queen_absent'
    | 'swarming_prep'
    | 'stress_alarm'
    | 'foraging'
    | 'human_voice'
    | 'silence'
    | 'unknown';

export interface ClassificationResult {
    behavior: BeeBehavior;
    confidence: number;
    secondaryBehavior: BeeBehavior | null;
    secondaryConfidence: number;
    indicators: string[];
    scientificNotes: string[];
}

// Signature templates for each behavior (threshold, weight)
interface Signature {
    minCentroid?: number;
    maxCentroid?: number;
    minBandwidth?: number;
    maxBandwidth?: number;
    minRolloff?: number;
    maxRolloff?: number;
    minFlatness?: number;
    maxFlatness?: number;
    minFlux?: number;
    maxFlux?: number;
    minRMS?: number;
    maxRMS?: number;
    minZCR?: number;
    maxZCR?: number;
    minBPM?: number;
    maxBPM?: number;
    minModRate?: number;
    maxModRate?: number;
    minModDepth?: number;
    minBandLow?: number;
    maxBandLow?: number;
    minBandMid?: number;
    maxBandMid?: number;
    minBandQueen?: number;
    maxBandQueen?: number;
    minBandAbsent?: number;
    maxBandAbsent?: number;
    minBandStress?: number;
    maxBandStress?: number;
    minBandHarmonic?: number;
    maxBandHarmonic?: number;
    minSustain?: number;
    maxSustain?: number;
    minAttack?: number;
    maxAttack?: number;
    minCrest?: number;
    maxCrest?: number;
}

const SIGNATURES: Record<string, { sig: Signature; weight: number }> = {
    healthy_colony: {
        weight: 1.0,
        sig: {
            minCentroid: 80, maxCentroid: 600,
            minRMS: 0.005,
            minBandLow: 80, minBandMid: 100,
            maxFlatness: 0.3,
            minSustain: 0.3,
            minModDepth: 0.05,
        },
    },
    queen_piping: {
        weight: 1.5,
        sig: {
            minCentroid: 180, maxCentroid: 700,
            minBandQueen: 60,
            minFlux: 0.01,
            minModRate: 2, maxModRate: 12,
            minModDepth: 0.15,
            maxRMS: 0.1,
        },
    },
    queen_absent: {
        weight: 1.2,
        sig: {
            minCentroid: 300, maxCentroid: 1200,
            minBandAbsent: 50,
            maxBandMid: 80,
            minFlatness: 0.1,
        },
    },
    swarming_prep: {
        weight: 1.3,
        sig: {
            minCentroid: 120, maxCentroid: 500,
            minRMS: 0.008,
            minBandMid: 60, minBandQueen: 30,
            minFlux: 0.02,
            minModRate: 10, maxModRate: 35,
            minModDepth: 0.1,
        },
    },
    stress_alarm: {
        weight: 1.4,
        sig: {
            minCentroid: 400,
            minBandStress: 40,
            minFlatness: 0.15,
            minZCR: 0.02,
            minFlux: 0.03,
            minCrest: 3,
        },
    },
    foraging: {
        weight: 1.0,
        sig: {
            minCentroid: 100, maxCentroid: 500,
            minRMS: 0.003,
            minBandLow: 40, minBandMid: 50,
            minModRate: 5, maxModRate: 20,
            minModDepth: 0.05,
            maxFlatness: 0.25,
        },
    },
    human_voice: {
        weight: 1.6,
        sig: {
            minCentroid: 150, maxCentroid: 800,
            minBandwidth: 200,
            minFlatness: 0.2,
            minZCR: 0.04,
            minCrest: 4,
        },
    },
    silence: {
        weight: 2.0,
        sig: {
            maxCentroid: 100,
            maxRMS: 0.002,
            maxBandLow: 30,
            maxBandMid: 30,
        },
    },
};

function scoreFeature(value: number, min?: number, max?: number): number {
    if (min !== undefined && value < min) return 0;
    if (max !== undefined && value > max) return 0;

    let score = 1;
    if (min !== undefined) {
        const margin = min * 0.5;
        if (value < min) return 0;
        score = Math.min(score, 1 - (value - min) / (margin || 1));
    }
    if (max !== undefined) {
        const margin = max * 0.5;
        if (value > max) return 0;
        score = Math.min(score, 1 - (max - value) / (margin || 1));
    }
    return Math.max(0, Math.min(1, score));
}

function scoreSignature(features: AudioFeatures, sig: Signature): number {
    const scores: number[] = [];

    if (sig.minCentroid !== undefined || sig.maxCentroid !== undefined) {
        scores.push(scoreFeature(features.spectralCentroid, sig.minCentroid, sig.maxCentroid));
    }
    if (sig.minBandwidth !== undefined || sig.maxBandwidth !== undefined) {
        scores.push(scoreFeature(features.spectralBandwidth, sig.minBandwidth, sig.maxBandwidth));
    }
    if (sig.minRolloff !== undefined || sig.maxRolloff !== undefined) {
        scores.push(scoreFeature(features.spectralRolloff, sig.minRolloff, sig.maxRolloff));
    }
    if (sig.minFlatness !== undefined || sig.maxFlatness !== undefined) {
        scores.push(scoreFeature(features.spectralFlatness, sig.minFlatness, sig.maxFlatness));
    }
    if (sig.minFlux !== undefined || sig.maxFlux !== undefined) {
        scores.push(scoreFeature(features.spectralFlux, sig.minFlux, sig.maxFlux));
    }
    if (sig.minRMS !== undefined || sig.maxRMS !== undefined) {
        scores.push(scoreFeature(features.rmsEnergy, sig.minRMS, sig.maxRMS));
    }
    if (sig.minZCR !== undefined || sig.maxZCR !== undefined) {
        scores.push(scoreFeature(features.zeroCrossingRate, sig.minZCR, sig.maxZCR));
    }
    if (sig.minBPM !== undefined || sig.maxBPM !== undefined) {
        scores.push(scoreFeature(features.bpm, sig.minBPM, sig.maxBPM));
    }
    if (sig.minModRate !== undefined || sig.maxModRate !== undefined) {
        scores.push(scoreFeature(features.modulationRate, sig.minModRate, sig.maxModRate));
    }
    if (sig.minModDepth !== undefined) {
        scores.push(scoreFeature(features.modulationDepth, sig.minModDepth));
    }
    if (sig.minBandLow !== undefined || sig.maxBandLow !== undefined) {
        scores.push(scoreFeature(features.bands.low50_150, sig.minBandLow, sig.maxBandLow));
    }
    if (sig.minBandMid !== undefined || sig.maxBandMid !== undefined) {
        scores.push(scoreFeature(features.bands.mid150_350, sig.minBandMid, sig.maxBandMid));
    }
    if (sig.minBandQueen !== undefined || sig.maxBandQueen !== undefined) {
        scores.push(scoreFeature(features.bands.queen350_500, sig.minBandQueen, sig.maxBandQueen));
    }
    if (sig.minBandAbsent !== undefined || sig.maxBandAbsent !== undefined) {
        scores.push(scoreFeature(features.bands.absent500_1000, sig.minBandAbsent, sig.maxBandAbsent));
    }
    if (sig.minBandStress !== undefined || sig.maxBandStress !== undefined) {
        scores.push(scoreFeature(features.bands.stress1000_3000, sig.minBandStress, sig.maxBandStress));
    }
    if (sig.minSustain !== undefined || sig.maxSustain !== undefined) {
        scores.push(scoreFeature(features.sustainLevel, sig.minSustain, sig.maxSustain));
    }
    if (sig.maxAttack !== undefined) {
        scores.push(scoreFeature(features.attackTime, undefined, sig.maxAttack));
    }
    if (sig.minCrest !== undefined || sig.maxCrest !== undefined) {
        scores.push(scoreFeature(features.crestFactor, sig.minCrest, sig.maxCrest));
    }

    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// --- Scientific indicator text ---
const INDICATORS: Record<string, { positive: string; negative: string }> = {
    healthy_colony: {
        positive: 'Colmeia com actividade saudável — zumbido constante em 100-500Hz',
        negative: 'Actividade reduzida ou ausente na banda de zumbido normal',
    },
    queen_piping: {
        positive: 'Rainha presente — sinais de piping (toot-toot) detetados em 260-500Hz',
        negative: 'Sem sinais de piping da rainha',
    },
    queen_absent: {
        positive: 'Possível ausência da rainha — frequências elevadas (478-1080Hz) dominam',
        negative: 'Padrão acústico compatível com presença da rainha',
    },
    swarming_prep: {
        positive: 'Sinais de preparação para enxameio — modulação de amplitude 15-30Hz',
        negative: 'Sem sinais de preparação para enxameio',
    },
    stress_alarm: {
        positive: 'Actividade de stress/alerta — energia elevada em >1000Hz, padrão irregular',
        negative: 'Sem sinais de stress ou alarme',
    },
    foraging: {
        positive: 'Actividade de forrageamento — modulação 10-20Hz, banda 100-400Hz',
        negative: 'Actividade de forrageamento reduzida',
    },
    human_voice: {
        positive: 'Áudio contém voz humana ou som não-abelha — alta dispersão espectral',
        negative: 'Áudio autêntico de colmeia',
    },
    silence: {
        positive: 'Silêncio ou colmeia muito quieta — energia quase zero',
        negative: 'Actividade sonora detetada',
    },
};

const SCIENTIFIC: Record<string, string> = {
    healthy_colony: 'Ref: Michelsen et al. (1986), Seeley (1995) — zumbido constante 100-500Hz indica rainha presente e kolonie saudável',
    queen_piping: 'Ref: Tan et al. (2012), Myerscough (1993) — piping 260-500Hz com modulação 2-10Hz = rainha virgem a anunciar presença',
    queen_absent: 'Ref: Seeley (1985), Woyke (1991) — frequência dominante 478-1080Hz sem harmónicos baixos = ausência da rainha',
    swarming_prep: 'Ref: Seeley (1995), Kirchner (1993) — tremble dance 15-30Hz + banda 250-500Hz elevada = preparação para enxameio',
    stress_alarm: 'Ref: Free (1987), Nouvian & Bhatt (2018) — >1000Hz com alta energia espectral = resposta a predador ou stress químico',
    foraging: 'Ref: Wenner (1964), Seeley (1994) — modulação 10-15Hz = dança de orientação, actividades de coleta',
    human_voice: 'Ref: Análise espectral — ZCR >0.04, spectral flatness >0.2 = voz humana ou ruído não-abelha',
    silence: 'Ref: Monitoramento passivo — sem actividade sonora significativa',
};

export function classifyBehavior(features: AudioFeatures): ClassificationResult {
    const scores: Record<string, number> = {};

    for (const [name, { sig, weight }] of Object.entries(SIGNATURES)) {
        scores[name] = scoreSignature(features, sig) * weight;
    }

    // Sort by score
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [bestName, bestScore] = sorted[0];
    const [secondName, secondScore] = sorted.length > 1 ? sorted[1] : ['unknown', 0];

    const behavior = bestName as BeeBehavior;
    const confidence = Math.min(1, bestScore);
    const secondaryBehavior = secondScore > 0.3 ? secondName as BeeBehavior : null;
    const secondaryConfidence = Math.min(1, secondScore);

    // Build indicators
    const indicators: string[] = [];
    const scientificNotes: string[] = [];

    for (const [name, score] of sorted) {
        if (score > 0.4) {
            const ind = INDICATORS[name];
            if (ind) indicators.push(score > 0.7 ? ind.positive : ind.negative);
            const sci = SCIENTIFIC[name];
            if (sci) scientificNotes.push(sci);
        }
    }

    return {
        behavior,
        confidence,
        secondaryBehavior,
        secondaryConfidence,
        indicators,
        scientificNotes,
    };
}

// --- Human-readable behavior name ---
export const BEHAVIOR_NAMES: Record<BeeBehavior, string> = {
    healthy_colony: 'Colmeia Saudável',
    queen_piping: 'Rainha Presente (Piping)',
    queen_absent: 'Rainha Ausente',
    swarming_prep: 'Preparação para Enxameio',
    stress_alarm: 'Stress / Alarme',
    foraging: 'Forrageamento Activo',
    human_voice: 'Voz Humana / Não-Abelha',
    silence: 'Silêncio / Colmeia Vazia',
    unknown: 'Desconhecido',
};

export const BEHAVIOR_EMOJI: Record<BeeBehavior, string> = {
    healthy_colony: '🐝',
    queen_piping: '👑',
    queen_absent: '⚠️',
    swarming_prep: '🔄',
    stress_alarm: '🚨',
    foraging: '🌸',
    human_voice: '🗣️',
    silence: '🔇',
    unknown: '❓',
};

export const BEHAVIOR_DESCRIPTIONS: Record<BeeBehavior, string> = {
    healthy_colony: 'A colmeia apresenta actividade normal com zumbido constante na banda 100-500Hz. A rainha provavelmente está presente e a postura é regular.',
    queen_piping: 'Sinais acústicos de piping (toot-toot) em 260-500Hz com modulação 2-10Hz. A rainha virgem está a anunciar a sua presença ou a desafiar outras rainhas.',
    queen_absent: 'Frequências elevadas (478-1080Hz) dominam o espectro. A colmeia pode estar sem rainha — verificar presença de ovos e cria.',
    swarming_prep: 'Modulação de amplitude 15-30Hz (tremble dance) e banda 250-500Hz elevada. A colmeia está a preparar enxameio — considerar dividir a colmeia.',
    stress_alarm: 'Energia elevada em frequências >1000Hz com padrão irregular. Poderá haver predador, vibração anormal ou stress químico na zona.',
    foraging: 'Actividade de forrageamento com modulação 10-20Hz (dança de orientação). Abelhas a colectar néctar/pólen.',
    human_voice: 'O áudio contém voz humana ou som não-abelha. A análise apícola não é aplicável a este registo.',
    silence: 'Silêncio quase total — colmeia pode estar vazia, em hibernação, ou em período de pouca actividade.',
    unknown: 'Padrão acústico não identificado. Poderá ser um som não convencional ou misto.',
};
