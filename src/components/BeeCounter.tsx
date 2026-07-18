import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, BarChart3, Volume2, Zap, AlertTriangle, CheckCircle, RotateCcw } from 'lucide-react';
import { saveBeeActivity, getActivityHistory, type BeeActivity } from '../api';

const BEE_FREQ_LOW = 50;
const BEE_FREQ_HIGH = 500;
const PULSE_THRESHOLD = 40;

export const BeeCounter: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [results, setResults] = useState<BeeActivity | null>(null);
    const [history, setHistory] = useState<BeeActivity[]>([]);
    const [timer, setTimer] = useState('00:00');
    const [liveBeesPerMin, setLiveBeesPerMin] = useState(0);
    const [liveEnergy, setLiveEnergy] = useState(0);
    const [analyzing, setAnalyzing] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const isRecordingRef = useRef(false);
    const startTimeRef = useRef<number>(0);
    const peakCountRef = useRef(0);
    const freqHistoryRef = useRef<number[]>([]);
    const waveDataRef = useRef<number[]>([]);
    const animFrameRef = useRef<number>(0);
    const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        getActivityHistory().then(setHistory);
    }, []);

    useEffect(() => {
        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            cancelAnimationFrame(animFrameRef.current);
        };
    }, []);

    const drawWaveform = useCallback(() => {
        if (!analyserRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.scale(dpr, dpr);
        }

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        const nyquist = (audioContextRef.current?.sampleRate || 44100) / 2;
        const binHz = nyquist / bufferLength;
        const lowBin = Math.floor(BEE_FREQ_LOW / binHz);
        const highBin = Math.min(Math.ceil(BEE_FREQ_HIGH / binHz), bufferLength);

        let beeSum = 0;
        let beeCount = 0;
        for (let i = lowBin; i < highBin; i++) {
            beeSum += dataArray[i];
            beeCount++;
        }
        const beeAvg = beeCount > 0 ? beeSum / beeCount : 0;
        const height = Math.round(Math.max(4, (beeAvg / 128) * 50));
        waveDataRef.current = [...waveDataRef.current.slice(-199), height];

        freqHistoryRef.current.push(beeAvg);
        if (freqHistoryRef.current.length > 600) freqHistoryRef.current.shift();

        const now = Date.now();
        const windowMs = 10000;
        const recentPeaks = freqHistoryRef.current.filter((_v, i) => {
            const age = now - startTimeRef.current - (freqHistoryRef.current.length - 1 - i) * (1000 / 30);
            return age > (now - startTimeRef.current - windowMs);
        });
        const peakCount = recentPeaks.filter(v => v > PULSE_THRESHOLD).length;
        peakCountRef.current = peakCount;

        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const bps = elapsed > 0 ? Math.round((peakCount / elapsed) * 60) : 0;
        setLiveBeesPerMin(bps);
        setLiveEnergy(Math.round(beeAvg));

        ctx.clearRect(0, 0, w, h);
        const data = waveDataRef.current;
        const barW = 2;
        const gap = 1;
        const totalW = data.length * (barW + gap);
        const startX = Math.max(0, w - totalW);
        data.forEach((val, i) => {
            const x = startX + i * (barW + gap);
            const barH = Math.max(2, (val / 50) * h);
            ctx.fillStyle = val > PULSE_THRESHOLD ? '#f59e0b' : '#22c55e';
            ctx.fillRect(x, h - barH, barW, barH);
        });

        if (isRecordingRef.current) {
            animFrameRef.current = requestAnimationFrame(drawWaveform);
        }
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            await audioContextRef.current.resume();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 2048;
            analyserRef.current.smoothingTimeConstant = 0.8;
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);

            audioChunksRef.current = [];
            freqHistoryRef.current = [];
            peakCountRef.current = 0;
            waveDataRef.current = [];

            recorderRef.current = new MediaRecorder(stream);
            recorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
            recorderRef.current.start();

            isRecordingRef.current = true;
            setIsRecording(true);
            setResults(null);
            startTimeRef.current = Date.now();
            drawWaveform();

            timerIntervalRef.current = setInterval(() => {
                if (!isRecordingRef.current) {
                    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                    return;
                }
                const diff = Date.now() - startTimeRef.current;
                const seconds = Math.floor((diff / 1000) % 60);
                const minutes = Math.floor((diff / (1000 * 60)) % 60);
                setTimer(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            }, 100);
        } catch {
            alert('Erro ao aceder ao microfone. Verifique as permissões do navegador.');
        }
    };

    const stopRecording = () => {
        isRecordingRef.current = false;
        setIsRecording(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        cancelAnimationFrame(animFrameRef.current);
        recorderRef.current?.stop();
        streamRef.current?.getTracks().forEach(t => t.stop());
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        streamRef.current = null;
        recorderRef.current = null;
    };

    const analyze = async () => {
        setAnalyzing(true);
        stopRecording();
        await new Promise(r => setTimeout(r, 100));

        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const allFreqs = freqHistoryRef.current;
        const peaksDetected = allFreqs.filter(v => v > PULSE_THRESHOLD).length;
        const avgEnergy = allFreqs.length > 0 ? allFreqs.reduce((a, b) => a + b, 0) / allFreqs.length : 0;
        const beesPerMin = elapsed > 0 ? Math.round((peaksDetected / elapsed) * 60) : 0;

        let activityLevel: BeeActivity['activityLevel'] = 'inativa';
        if (beesPerMin > 200) activityLevel = 'muito_alta';
        else if (beesPerMin > 100) activityLevel = 'alta';
        else if (beesPerMin > 40) activityLevel = 'moderada';
        else if (beesPerMin > 10) activityLevel = 'baixa';

        const activity: BeeActivity = {
            id: Date.now(),
            beesPerMin,
            peaksDetected,
            avgEnergy: Math.round(avgEnergy),
            durationSec: Math.round(elapsed),
            activityLevel,
            created_at: new Date().toISOString(),
        };

        await saveBeeActivity(activity);
        setResults(activity);
        getActivityHistory().then(setHistory);
        setAnalyzing(false);
    };

    const reset = () => {
        stopRecording();
        setTimer('00:00');
        setLiveBeesPerMin(0);
        setLiveEnergy(0);
        setResults(null);
        waveDataRef.current = [];
        freqHistoryRef.current = [];
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    };

    const getActivityColor = (level: string) => {
        switch (level) {
            case 'muito_alta': return 'text-red-600 bg-red-50 border-red-200';
            case 'alta': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'moderada': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
            case 'baixa': return 'text-blue-600 bg-blue-50 border-blue-200';
            default: return 'text-slate-600 bg-slate-50 border-slate-200';
        }
    };

    const getActivityIcon = (level: string) => {
        switch (level) {
            case 'muito_alta': return <AlertTriangle className="w-4 h-4" />;
            case 'alta': return <Zap className="w-4 h-4" />;
            case 'moderada': return <BarChart3 className="w-4 h-4" />;
            case 'baixa': return <Volume2 className="w-4 h-4" />;
            default: return <CheckCircle className="w-4 h-4" />;
        }
    };

    const getActivityLabel = (level: string) => {
        switch (level) {
            case 'muito_alta': return 'Muito Alta';
            case 'alta': return 'Alta';
            case 'moderada': return 'Moderada';
            case 'baixa': return 'Baixa';
            default: return 'Inativa';
        }
    };

    const last24h = history.filter(h => {
        const diff = Date.now() - new Date(h.created_at).getTime();
        return diff < 86400000;
    });
    const avgBees24h = last24h.length > 0
        ? Math.round(last24h.reduce((a, b) => a + b.beesPerMin, 0) / last24h.length)
        : 0;

    return (
        <div className="space-y-6">
            <div className="glass-card rounded-3xl p-4 sm:p-6 lg:p-8">
                <div className="flex items-center gap-3 mb-6">
                    <BarChart3 className="w-6 h-6 text-primary-dark" />
                    <div>
                        <span className="text-primary-dark text-xs font-black uppercase tracking-[0.3em] mb-1 block">Contador de Abelhas</span>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Atividade por Áudio</h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white/50 rounded-2xl p-4 text-center">
                        <div className={`text-3xl font-black transition-colors ${liveBeesPerMin > 100 ? 'text-red-600' : liveBeesPerMin > 40 ? 'text-amber-500' : 'text-primary-dark'}`}>
                            {liveBeesPerMin}
                        </div>
                        <div className="text-xs font-bold text-slate-600 mt-1">abelhas/minuto</div>
                    </div>
                    <div className="bg-white/50 rounded-2xl p-4 text-center">
                        <div className={`text-3xl font-black transition-colors ${liveEnergy > PULSE_THRESHOLD ? 'text-amber-500' : 'text-green-500'}`}>{liveEnergy}</div>
                        <div className="text-xs font-bold text-slate-600 mt-1">energia (0-255)</div>
                    </div>
                    <div className="bg-white/50 rounded-2xl p-4 text-center">
                        <div className="text-3xl font-black text-slate-700 font-mono">{timer}</div>
                        <div className="text-xs font-bold text-slate-600 mt-1">duração</div>
                    </div>
                </div>

                <div className="mb-4">
                    <canvas
                        ref={canvasRef}
                        className="w-full h-24 bg-black/20 rounded-xl"
                        style={{ imageRendering: 'pixelated' }}
                    />
                </div>

                <div className="flex flex-wrap gap-3">
                    {isRecording ? (
                        <>
                            <button
                                onClick={stopRecording}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-red-600/20"
                            >
                                <Square className="w-4 h-4" /> Parar
                            </button>
                            <button
                                onClick={analyze}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-dark text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-primary-dark/20"
                            >
                                <BarChart3 className="w-4 h-4" /> Analisar Agora
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={startRecording}
                                disabled={analyzing}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-dark text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-primary-dark/20 disabled:opacity-50"
                            >
                                <Mic className="w-4 h-4" /> {analyzing ? 'A analisar...' : 'Gravar'}
                            </button>
                            {timer !== '00:00' && !analyzing && (
                                <button
                                    onClick={reset}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-widest"
                                >
                                    <RotateCcw className="w-4 h-4" /> Limpar
                                </button>
                            )}
                        </>
                    )}
                </div>

                {analyzing && (
                    <div className="mt-4 flex items-center gap-2 text-primary-dark">
                        <div className="w-4 h-4 border-2 border-primary-dark border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-black animate-pulse">A analisar atividade...</span>
                    </div>
                )}
            </div>

            {results && (
                <div className="glass-card rounded-3xl p-4 sm:p-6 lg:p-8">
                    <h3 className="text-lg font-black text-slate-900 mb-4">Resultado da Análise</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                            <div className="text-2xl font-black text-primary-dark">{results.beesPerMin}</div>
                            <div className="text-[10px] font-bold text-slate-600">abelhas/min</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-slate-700">{results.peaksDetected}</div>
                            <div className="text-[10px] font-bold text-slate-600">picos detetados</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-slate-700">{results.avgEnergy}</div>
                            <div className="text-[10px] font-bold text-slate-600">energia média</div>
                        </div>
                        <div className="text-center">
                            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border ${getActivityColor(results.activityLevel)}`}>
                                {getActivityIcon(results.activityLevel)}
                                {getActivityLabel(results.activityLevel)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="glass-card rounded-3xl p-4 sm:p-6 lg:p-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-slate-900">Histórico de Atividade</h3>
                    <span className="text-xs font-bold text-slate-500">Média 24h: {avgBees24h} abelhas/min</span>
                </div>
                {history.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">Nenhuma gravação ainda. Comece por gravar áudio perto da colmeia.</p>
                ) : (
                    <div className="space-y-2">
                        {history.slice(0, 20).map(h => (
                            <div key={h.id} className="flex items-center gap-3 bg-white/50 rounded-xl p-3">
                                <div className={`shrink-0 ${getActivityColor(h.activityLevel)} p-1.5 rounded-lg border`}>
                                    {getActivityIcon(h.activityLevel)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-slate-900">{h.beesPerMin} abelhas/min</span>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${getActivityColor(h.activityLevel)}`}>
                                            {getActivityLabel(h.activityLevel)}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-bold">
                                        {h.durationSec}s • {h.peaksDetected} picos • energia {h.avgEnergy}
                                    </div>
                                </div>
                                <span className="text-[10px] text-slate-400 font-bold shrink-0">
                                    {new Date(h.created_at).toLocaleString('pt-AO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BeeCounter;
