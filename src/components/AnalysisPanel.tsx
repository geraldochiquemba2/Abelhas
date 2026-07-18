import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, Square, Sparkles, Image } from 'lucide-react';
import { saveDiagnostic } from '../api';

type Msg = { text: string; isUser: boolean };

const callChat = async (messages: any[], model = 'llama-3.3-70b-versatile') => {
    const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, model }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    if (!data.choices?.[0]?.message?.content) throw new Error('Resposta inválida da API. Verifica a GROQ_API_KEY.');
    return data.choices[0].message.content;
};

export const AnalysisPanel: React.FC = () => {
    const [isListening, setIsListening] = useState(false);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [timer, setTimer] = useState('00:00');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const waveDataRef = useRef<number[]>([]);

    const [photo, setPhoto] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState<'audio' | 'photo' | 'chat' | null>(null);
    const isListeningRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const freqSamplesRef = useRef<number[][]>([]);
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
                await audioContextRef.current.resume();
                analyserRef.current = audioContextRef.current.createAnalyser();
                analyserRef.current.fftSize = 2048;
                analyserRef.current.smoothingTimeConstant = 0.8;
                const source = audioContextRef.current.createMediaStreamSource(stream);
                source.connect(analyserRef.current);

                audioChunksRef.current = [];
                freqSamplesRef.current = [];
                recorderRef.current = new MediaRecorder(stream);
                recorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
                recorderRef.current.onstop = async () => {
                    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    if (blob.size > 0) await analyzeAudio(blob);
                };
                recorderRef.current.start();

                isListeningRef.current = true;
                setIsListening(true);
                startTimeRef.current = Date.now();
                waveDataRef.current = [];

                const bufferLength = analyserRef.current.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                let sampleCount = 0;

                const updateVisuals = () => {
                    if (!analyserRef.current) return;
                    analyserRef.current.getByteFrequencyData(dataArray);
                    const avgValue = Array.from(dataArray).reduce((a, b) => a + b, 0) / dataArray.length;
                    const height = Math.round(Math.max(4, (avgValue / 128) * 50));
                    waveDataRef.current = [...waveDataRef.current.slice(-199), height];

                    const canvas = canvasRef.current;
                    if (canvas) {
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            const dpr = window.devicePixelRatio || 1;
                            const w = canvas.clientWidth;
                            const h = canvas.clientHeight;
                            if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
                                canvas.width = w * dpr;
                                canvas.height = h * dpr;
                                ctx.scale(dpr, dpr);
                            }
                            ctx.clearRect(0, 0, w, h);
                            const data = waveDataRef.current;
                            const barW = 2;
                            const gap = 1;
                            const totalW = data.length * (barW + gap);
                            const startX = Math.max(0, w - totalW);
                            ctx.fillStyle = '#ef4444';
                            data.forEach((val, i) => {
                                const x = startX + i * (barW + gap);
                                const barH = Math.max(2, (val / 50) * h);
                                ctx.fillRect(x, h - barH, barW, barH);
                            });
                        }
                    }

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

                        freqSamplesRef.current.push([
                            band(50, 150),
                            band(150, 350),
                            band(350, 500),
                            band(500, 1000),
                            band(1000, 3000),
                            band(3000, 8000),
                        ]);
                    }

                    const diff = Date.now() - startTimeRef.current;
                    const seconds = Math.floor((diff / 1000) % 60);
                    const minutes = Math.floor((diff / (1000 * 60)) % 60);
                    setTimer(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
                    if (isListeningRef.current) requestAnimationFrame(updateVisuals);
                };
                updateVisuals();
            } catch {
                alert('Erro ao aceder ao microfone. Verifique se concedeu permissão.');
            }
        } else {
            isListeningRef.current = false;
            setIsListening(false);
            recorderRef.current?.stop();
            if (audioContextRef.current) audioContextRef.current.close();
            streamRef.current?.getTracks().forEach((t) => t.stop());
        }
    };

    const analyzeAudio = async (_blob: Blob) => {
        try {
            setAnalyzing('audio');

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
                        'És um especialista em apicultura e bioacústica de abelhas. Recebes dados de frequência de áudio de uma gravação de colmeia.\n\n' +
                        'IMPORTANTE: Analisa OS VALORES REAIS. Se os valores de frequência estiverem tous (próximos de 0/255), significa que NÃO há atividade significativa de abelhas. Se os valores estiverem elevados em bandas específicas, indica atividade nessa faixa.\n\n' +
                        'Indica:\n' +
                        '1. Estado da rainha (presente/ausente/enxameio)\n' +
                        '2. Nível de atividade da colónia (mínimo/médio/alto)\n' +
                        '3. Sinais de enxameio, stress ou pragas\n' +
                        '4. Recomendação prática\n\n' +
                        'Valores de referência:\n' +
                        '- Atividade normal de colmeia: 100-200/255 nas bandas 50-350Hz\n' +
                        '- Rainha "tooting": pico 350-500Hz\n' +
                        '- Rainha ausente: pico 478-1080Hz\n' +
                        '- Colmeia sem abelhas ou ambíente silencioso: valores < 30/255 em todas as bandas\n' +
                        '- Som humano/voz: concentração na banda 150-1000Hz com valores elevados\n' +
                        '- Som de palmas/clapping: pico em frequências altas (1000-8000Hz)\n\n' +
                        'Se os dados mostrarem pouca atividade ou padrões que não correspondem a uma colmeia real, indica isso claramente. Sê honesto e direto. Responde em português.',
                },
                {
                    role: 'user',
                    content:
                        `DADOS REAIS DE FREQUÊNCIA - Gravação de áudio (${durationSec}s, ${samples.length} amostras coletadas a cada ~500ms):\n\n` +
                        freqSummary + '\n\n' +
                        'Cada valor é a média de amplitude na banda de frequência (0=silêncio, 255=máximo).\n' +
                        'Os dados acima representam o que foi DETETADO no áudio gravado. Analisa os valores numéricos reais, não assumes nada.\n\n' +
                        'Dá o diagnóstico com base nos dados numéricos.',
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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxW = 1024;
                const ratio = Math.min(maxW / img.width, maxW / img.height, 1);
                canvas.width = img.width * ratio;
                canvas.height = img.height * ratio;
                canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
                setPhoto(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = ev.target?.result as string;
        };
        reader.readAsDataURL(file);
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
            if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
            if (!data.choices?.[0]?.message?.content) throw new Error('Resposta inválida da API de visão.');
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
        <div className="glass-card rounded-3xl lg:rounded-[3rem] p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                    <span className="text-primary-dark text-xs font-black uppercase tracking-[0.3em] mb-1 block">Diagnóstico</span>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Análise da Colmeia</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    <canvas ref={canvasRef} className="w-full sm:w-48 h-12 bg-black/20 rounded-xl" style={{ imageRendering: 'pixelated' }} />
                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1">
                        <span className={`text-[10px] font-black text-primary-dark transition-opacity ${isListening ? 'opacity-100' : 'opacity-0'}`}>{timer}</span>
                        <button
                            onClick={toggleListening}
                            className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl transition-all shadow-lg shadow-primary-dark/20 group ${isListening ? 'bg-red-600' : 'bg-primary-dark'} text-white`}
                        >
                            {isListening ? <Square className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
                            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">{isListening ? 'Parar' : 'Ouvir Enxame'}</span>
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
                    {photo ? (
                        <img src={photo} alt="colmeia" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-slate-500 font-bold text-xs sm:text-sm">Nenhuma imagem carregada</span>
                    )}
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3 mt-3">
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-primary-dark text-white font-black text-[10px] sm:text-xs uppercase tracking-widest">
                        <Image className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {photo ? 'Carregar Outra' : 'Carregar Foto'}
                    </button>
                    {photo && (
                        <button onClick={analyzePhoto} disabled={analyzing === 'photo'} className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-primary text-slate-900 font-black text-[10px] sm:text-xs uppercase tracking-widest disabled:opacity-50">
                            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {analyzing === 'photo' ? 'Analisando...' : 'Analisar com IA'}
                        </button>
                    )}
                </div>
            </div>

            <p className="text-base lg:text-xl font-medium text-slate-800 leading-tight mb-6 lg:mb-8 italic border-l-4 border-primary-dark pl-4 lg:pl-6">
                "Use <span className="text-primary-dark font-black">Ouvir Enxame</span> para áudio e <span className="text-primary-dark font-black">Câmara</span> para imagem. O Groq gera o diagnóstico abaixo."
            </p>

            <div className="glass-card rounded-2xl lg:rounded-[2rem] p-4 sm:p-6 flex flex-col h-[350px] sm:h-[420px]">
                <h3 className="text-base lg:text-lg font-black text-slate-900 mb-3 lg:mb-4 flex items-center gap-3">Tirar Dúvida com IA</h3>
                <div ref={chatMessagesRef} className="bg-black/5 rounded-2xl p-3 sm:p-4 mb-3 lg:mb-4 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.isUser ? 'justify-end' : 'justify-start'}`}>
                            <div className={`${m.isUser ? 'bg-primary-dark text-white' : 'bg-white/80 text-slate-800'} p-2.5 sm:p-3 rounded-2xl shadow-sm max-w-[90%] text-xs font-medium whitespace-pre-wrap`}>
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
                        className="flex-1 bg-white/50 border-none rounded-2xl py-2.5 sm:py-3 px-4 sm:px-5 text-sm font-bold focus:ring-primary-dark"
                    />
                    <button onClick={handleSendMessage} className="p-2.5 sm:p-3 bg-primary text-slate-900 rounded-2xl hover:brightness-110 transition-all">
                        <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </div>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
            />

        </div>
    );
};

export default AnalysisPanel;
