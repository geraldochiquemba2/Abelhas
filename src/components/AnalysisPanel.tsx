import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, Camera, Square, Sparkles } from 'lucide-react';
import { saveDiagnostic } from '../api';

type Msg = { text: string; isUser: boolean };

const callChat = async (messages: any[], model = 'llama-3.3-70b-versatile') => {
    const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, model }),
    });
    const data = await res.json();
    return data.choices[0].message.content;
};

export const AnalysisPanel: React.FC = () => {
    const [isListening, setIsListening] = useState(false);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [waveHistory, setWaveHistory] = useState<number[]>([]);
    const [_frequencyData, setFrequencyData] = useState<number[]>([]);
    const [timer, setTimer] = useState('00:00');

    const [cameraActive, setCameraActive] = useState(false);
    const [photo, setPhoto] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState<'audio' | 'photo' | 'chat' | null>(null);

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const freqSamplesRef = useRef<number[][]>([]);
    const videoRef = useRef<HTMLVideoElement>(null);
    const chatMessagesRef = useRef<HTMLDivElement>(null);
    const startTimeRef = useRef<number>(0);

    useEffect(() => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    }, [messages]);

    const toggleListening = async () => {
        if (!isListening) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                analyserRef.current = audioContextRef.current.createAnalyser();
                analyserRef.current.fftSize = 2048;
                analyserRef.current.smoothingTimeConstant = 0.8;
                const source = audioContextRef.current.createMediaStreamSource(stream);
                source.connect(analyserRef.current);

                audioChunksRef.current = [];
                freqSamplesRef.current = [];
                recorderRef.current = new MediaRecorder(stream);
                recorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
                recorderRef.current.start();

                setIsListening(true);
                startTimeRef.current = Date.now();
                setWaveHistory([]);
                setFrequencyData([]);

                const bufferLength = analyserRef.current.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                let sampleCount = 0;

                const updateVisuals = () => {
                    if (!analyserRef.current) return;
                    analyserRef.current.getByteFrequencyData(dataArray);
                    const avgValue = Array.from(dataArray).reduce((a, b) => a + b, 0) / dataArray.length;
                    const height = Math.round(Math.max(4, (avgValue / 128) * 50));
                    setWaveHistory((prev) => [...prev.slice(-199), height]);

                    // Collect frequency band samples every ~500ms
                    sampleCount++;
                    if (sampleCount % 30 === 0) {
                        const nyquist = (audioContextRef.current?.sampleRate || 44100) / 2;
                        const binHz = nyquist / bufferLength;

                        const band = (lowHz: number, highHz: number) => {
                            const lowBin = Math.floor(lowHz / binHz);
                            const highBin = Math.min(Math.ceil(highHz / binHz), bufferLength);
                            let sum = 0, count = 0;
                            for (let i = lowBin; i < highBin; i++) { sum += dataArray[i]; count++; }
                            return count > 0 ? Math.round(sum / count) : 0;
                        };

                        // Bee-relevant frequency bands
                        freqSamplesRef.current.push([
                            band(50, 150),    // Low (normal hum, 100-260Hz activity)
                            band(150, 350),   // Mid-low (workers)
                            band(350, 500),   // Mid (queen tooting 350-500Hz)
                            band(500, 1000),  // High-mid (queenless 478-1080Hz)
                            band(1000, 3000), // High (stress, piping)
                            band(3000, 8000), // Very high (Varroa wing beat ~300Hz but harmonics go higher)
                        ]);
                    }

                    const diff = Date.now() - startTimeRef.current;
                    const seconds = Math.floor((diff / 1000) % 60);
                    const minutes = Math.floor((diff / (1000 * 60)) % 60);
                    setTimer(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
                    if (isListening) requestAnimationFrame(updateVisuals);
                };
                updateVisuals();
            } catch {
                alert('Erro ao aceder ao microfone. Verifique se concedeu permissão.');
            }
        } else {
            setIsListening(false);
            recorderRef.current?.stop();
            if (audioContextRef.current) audioContextRef.current.close();
            streamRef.current?.getTracks().forEach((t) => t.stop());

            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            if (blob.size > 0) await analyzeAudio(blob);
        }
    };

    const analyzeAudio = async (_blob: Blob) => {
        try {
            setAnalyzing('audio');

            // Compute average frequency bands from collected samples
            const samples = freqSamplesRef.current;
            let avgBands = [0, 0, 0, 0, 0, 0];
            if (samples.length > 0) {
                for (const s of samples) {
                    for (let i = 0; i < 6; i++) avgBands[i] += s[i];
                }
                avgBands = avgBands.map(v => Math.round(v / samples.length));
            }

            const durationSec = Math.round((Date.now() - startTimeRef.current) / 1000);
            const bandLabels = [
                'Atividade normal (50-150Hz)',
                'Operárias (150-350Hz)',
                'Rainha tooting (350-500Hz)',
                'Rainha ausente (500-1000Hz)',
                'Stress/Piping (1000-3000Hz)',
                'Harmónicos altos (3000-8000Hz)',
            ];
            const freqSummary = bandLabels.map((l, i) => `${l}: ${avgBands[i]}/255`).join('\n');

            const diagnosis = await callChat([
                {
                    role: 'system',
                    content:
                        'És um especialista em apicultura e bioacústica de abelhas. Analisa os dados de frequência de uma gravação de colmeia e indica:\n' +
                        '1. Estado da rainha (presente/ausente/enxameio)\n' +
                        '2. Nível de atividade da colónia\n' +
                        '3. Sinais de enxameio, stress ou pragas (ex.: Varroa)\n' +
                        '4. Recomendação prática\n' +
                        'Sê breve e prático (máx. 5 frases). Responde em português.',
                },
                {
                    role: 'user',
                    content:
                        `Análise de frequências de áudio da colmeia (duração: ${durationSec}s, ${samples.length} amostras):\n\n` +
                        freqSummary + '\n\n' +
                        'Referências: Rainha "tooting" 350-500Hz, rainha ausente 478-1080Hz, atividade normal 100-260Hz. Varroa destructor vibra a ~300Hz com harmónicos.\n\n' +
                        'Dá o diagnóstico com base nos dados de frequência.',
                },
            ]);
            setMessages((prev) => [...prev, { text: `🔊 Diagnóstico por áudio:\n\n${diagnosis}`, isUser: false }]);
            saveDiagnostic({ type: 'audio', input: freqSummary, result: diagnosis }).catch(() => {});
        } catch (e: any) {
            alert('Erro na análise de áudio: ' + e.message);
        } finally {
            setAnalyzing(null);
        }
    };

    const startCamera = async () => {
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                alert('Câmara não suportada neste navegador. Use Chrome ou Safari.');
                return;
            }
            if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
                alert('A câmara precisa de HTTPS para funcionar. Aceda via HTTPS.');
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            setCameraActive(true);
        } catch (e: any) {
            if (e.name === 'NotAllowedError') {
                alert('Permissão da câmara negada. Conceda permissão nas definições do navegador.');
            } else if (e.name === 'NotFoundError') {
                alert('Nenhuma câmara encontrada no dispositivo.');
            } else {
                alert('Erro ao aceder à câmara: ' + e.message);
            }
        }
    };

    const capturePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
        setPhoto(canvas.toDataURL('image/jpeg', 0.8));
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setCameraActive(false);
    };

    const analyzePhoto = async () => {
        if (!photo) return;
        try {
            setAnalyzing('photo');
            const res = await fetch('/api/vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: photo,
                    prompt: 'És um especialista em apicultura. Analisa esta imagem de uma colmeia/favo e deteta sinais de saúde: presença de Varroa, estado da rainha, feridas, fungo ou colónia fraca. Sê breve e prático (máx. 3 frases).',
                }),
            });
            const data = await res.json();
            const diagnosis = data.choices[0].message.content;
            setMessages((prev) => [...prev, { text: `📷 ${diagnosis}`, isUser: false }]);
            saveDiagnostic({ type: 'image', result: diagnosis }).catch(() => {});
        } catch (e: any) {
            alert('Erro: ' + e.message);
        } finally {
            setAnalyzing(null);
        }
    };

    const handleSendMessage = async () => {
        if (!inputValue) return;
        const userMsg = inputValue;
        setMessages((prev) => [...prev, { text: userMsg, isUser: true }]);
        setInputValue('');
        try {
            setAnalyzing('chat');
            const reply = await callChat([
                { role: 'system', content: 'És o assistente Colmeia Saudável, especialista em colmeias e bioacústica. Responde em português, de forma clara e útil para apicultores.' },
                ...messages.map((m) => ({ role: m.isUser ? 'user' : 'assistant', content: m.text })),
                { role: 'user', content: userMsg },
            ]);
            setMessages((prev) => [...prev, { text: reply, isUser: false }]);
            saveDiagnostic({ type: 'chat', input: userMsg, result: reply }).catch(() => {});
        } catch (e: any) {
            alert('Erro: ' + e.message);
        } finally {
            setAnalyzing(null);
        }
    };

    return (
        <div className="glass-card rounded-[3rem] p-8">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div>
                    <span className="text-primary-dark text-xs font-black uppercase tracking-[0.3em] mb-1 block">Diagnóstico</span>
                    <h2 className="text-3xl font-black text-slate-900">Análise da Colmeia</h2>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 overflow-x-auto w-48 h-12 bg-black/20 rounded-xl px-2">
                        {waveHistory.map((h, i) => (
                            <div key={i} className="w-1 bg-red-500 rounded-full shrink-0" style={{ height: `${h}px` }} />
                        ))}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className={`text-[10px] font-black text-primary-dark transition-opacity ${isListening ? 'opacity-100' : 'opacity-0'}`}>{timer}</span>
                        <button
                            onClick={toggleListening}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all shadow-lg shadow-primary-dark/20 group ${isListening ? 'bg-red-600' : 'bg-primary-dark'} text-white`}
                        >
                            {isListening ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            <span className="text-xs font-black uppercase tracking-widest">{isListening ? 'Parar' : 'Ouvir Enxame'}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                    <h4 className="text-primary-dark font-black text-[10px] uppercase tracking-widest">Visão (Câmara)</h4>
                    {analyzing === 'photo' && <span className="text-xs text-primary-dark font-bold animate-pulse">Analisando imagem...</span>}
                </div>
                <div className="rounded-2xl overflow-hidden bg-black/10 aspect-video flex items-center justify-center">
                    {cameraActive ? (
                        <video ref={videoRef} className="w-full h-full object-cover" muted />
                    ) : photo ? (
                        <img src={photo} alt="colmeia" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-slate-500 font-bold text-sm">Nenhuma imagem capturada</span>
                    )}
                </div>
                <div className="flex gap-3 mt-3">
                    {!cameraActive ? (
                        <button onClick={startCamera} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-dark text-white font-black text-xs uppercase tracking-widest">
                            <Camera className="w-4 h-4" /> Abrir Câmara
                        </button>
                    ) : (
                        <button onClick={capturePhoto} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-black text-xs uppercase tracking-widest">
                            <Camera className="w-4 h-4" /> Capturar
                        </button>
                    )}
                    {photo && !cameraActive && (
                        <>
                            <button onClick={startCamera} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-600 text-white font-black text-xs uppercase tracking-widest">
                                <Camera className="w-4 h-4" /> Repetir Foto
                            </button>
                            <button onClick={analyzePhoto} disabled={analyzing === 'photo'} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-slate-900 font-black text-xs uppercase tracking-widest disabled:opacity-50">
                                <Sparkles className="w-4 h-4" /> {analyzing === 'photo' ? 'Analisando...' : 'Analisar com IA'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <p className="text-xl lg:text-2xl font-medium text-slate-800 leading-tight mb-8 italic border-l-4 border-primary-dark pl-6">
                "Use <span className="text-primary-dark font-black">Ouvir Enxame</span> para áudio e <span className="text-primary-dark font-black">Câmara</span> para imagem. O Groq gera o diagnóstico abaixo."
            </p>

            <div className="glass-card rounded-[2rem] p-6 flex flex-col h-[420px]">
                <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">Tirar Dúvida com IA</h3>
                <div ref={chatMessagesRef} className="bg-black/5 rounded-2xl p-4 mb-4 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.isUser ? 'justify-end' : 'justify-start'}`}>
                            <div className={`${m.isUser ? 'bg-primary-dark text-white' : 'bg-white/80 text-slate-800'} p-3 rounded-2xl shadow-sm max-w-[90%] text-xs font-medium whitespace-pre-wrap`}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                    {analyzing === 'chat' && <div className="text-xs text-primary-dark font-bold animate-pulse">A IA está a responder...</div>}
                </div>
                <div className="relative flex items-center gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Sua dúvida..."
                        className="flex-1 bg-white/50 border-none rounded-2xl py-3 px-5 text-sm font-bold focus:ring-primary-dark"
                    />
                    <button onClick={handleSendMessage} className="p-3 bg-primary text-slate-900 rounded-2xl hover:brightness-110 transition-all">
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnalysisPanel;
