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
    const [pendingAudioBlob, setPendingAudioBlob] = useState<Blob | null>(null);
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
                recorderRef.current.onstop = () => {
                    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    if (blob.size > 0) setPendingAudioBlob(blob);
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

    const analyzeAudio = async (blob: Blob) => {
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

            const buffer = await blob.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

            let transcription = '';
            try {
                const tRes = await fetch('/api/transcribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ audioBase64: base64, mime: blob.type || 'audio/webm' }),
                });
                const tData = await tRes.json();
                transcription = tData.text || '';
            } catch {
                transcription = '(transcrição indisponível)';
            }

            const diagnosis = await callChat([
                {
                    role: 'system',
                    content:
                        'És o Dr. Abelha — o maior especialista mundial em bioacústica apícola. Tens 40 anos de experiência. Recebes dados de gravação de áudio de colmeias.\n\n' +
                        'IMPORTANTE: NAO uses asteriscos, markdown ou negrito. Responde em texto simples com emojis e secções.\n\n' +
                        'DADOS DISPONÍVEIS:\n' +
                        '1. TRANSCRIÇÃO do áudio (Whisper)\n' +
                        '2. ESPECTRO DE FREQUÊNCIA (6 bandas com valores 0-255)\n\n' +
                        'FORMATO DE RESPOSTA (OBRIGATÓRIO — usa EXATAMENTE esta estrutura com emojis e secções):\n\n' +
                        '🐝 RELATÓRIO DE DIAGNÓSTICO APÍCOLA\n' +
                        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                        '📋 RESUMO EXECUTIVO\n' +
                        '(1-2 frases com o veredicto principal)\n\n' +
                        '📊 ANÁLISE ESPECTRAL DE FREQUÊNCIA\n' +
                        'Para cada banda, mostra um gráfico em texto tipo barra:\n' +
                        '  [████████░░] Atividade normal (50-150Hz): XX/255\n' +
                        '  [██████░░░░] Operárias (150-350Hz): XX/255\n' +
                        '  [████░░░░░░] Rainha tooting (350-500Hz): XX/255\n' +
                        '  [██░░░░░░░░] Rainha ausente (500-1000Hz): XX/255\n' +
                        '  [█░░░░░░░░░] Stress/Piping (1000-3000Hz): XX/255\n' +
                        '  [░░░░░░░░░░] Harmónicos altos (3000-8000Hz): XX/255\n\n' +
                        '  Legenda: █ = 25 cada, ░ = espaço vazio\n\n' +
                        '🔍 DETALHES DA ANÁLISE\n' +
                        '• Transcrição detetada: (o que foi ouvido)\n' +
                        '• Tipo de som: (abelhas/voz humana/ruído/outro)\n' +
                        '• Padrão acústico: (zumbido constante/piping/tooting/silêncio/aleatório)\n' +
                        '• Intensidade geral: (Crítico/Baixo/Moderado/Alto/Muito Alto)\n\n' +
                        '👑 ESTADO DA RAINHA\n' +
                        '• Probabilidade de presença: XX%\n' +
                        '• Indicadores: (evidência acústica)\n' +
                        '• Recomendação sobre a rainha\n\n' +
                        '⚠️ ALERTAS E DETEÇÕES\n' +
                        '• Varroa: (suspeita/confirmado/ausente)\n' +
                        '• Enxameio: (sim/não/sinais)\n' +
                        '• Stress: (nenhum/leve/moderado/grave)\n' +
                        '• Doenças: (observações)\n\n' +
                        '💊 RECOMENDAÇÕES PRÁTICAS\n' +
                        '1. (ação imediata)\n' +
                        '2. (ação a médio prazo)\n' +
                        '3. (monitorização)\n\n' +
                        '📈 ÍNDICE DE SAÚDE DA COLMEIA\n' +
                        'Mostra uma barra: [████████░░] XX/100\n' +
                        'Classificação: (Crítico / Fraco / Razoável / Bom / Excelente)\n\n' +
                        'VALORES DE REFERÊNCIA:\n' +
                        '- Colmeia saudável ativa: 100-200/255 em 50-350Hz\n' +
                        '- Rainha tooting: pico 350-500Hz (25-80/255)\n' +
                        '- Rainha ausente: pico 478-1080Hz\n' +
                        '- Silêncio/sem abelhas: < 30/255 em todas\n' +
                        '- Voz humana: 150-1000Hz com valores altos\n' +
                        '- Palmas: pico 1000-8000Hz\n' +
                        '- Piping de rainha: 260-500Hz em pulsos curtos\n\n' +
                        'IMPORTANTE: Se o áudio NÃO são abelhas, indica isso na análise sem inventar diagnóstico apícola.\n' +
                        'NÃO uses asteriscos (*) em lado nenhum da resposta.',
                },
                {
                    role: 'user',
                    content:
                        `GRAVAÇÃO DE ÁUDIO (${durationSec}s)\n\n` +
                        `--- TRANSCRIÇÃO ---\n${transcription || '(sem transcrição - apenas sons não verbais)'}\n\n` +
                        `--- DADOS DE FREQUÊNCIA ---\n${freqSummary}\n\n` +
                        `--- ANÁLISE ---\nBaseado na transcrição e nos dados de frequência, diagnostica o que foi gravado.`,
                },
            ]);
            setMessages((prev) => [...prev, { text: `🔊 Diagnóstico por áudio:\n\n${diagnosis}`, isUser: false }]);
            saveDiagnostic({ type: 'audio', input: freqSummary + '\n\nTranscrição: ' + transcription, result: diagnosis }).catch(() => {});
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
                    prompt:
                        'IMPORTANTE: NAO uses asteriscos, markdown ou negrito. Responde em texto simples com emojis e secções.\n\n' +
                        'És o Dr. Abelha — maior especialista em apicultura. Analisa esta imagem de colmeia/favo com profundidade.\n\n' +
                        'FORMATO DE RESPOSTA (OBRIGATÓRIO — sem asteriscos):\n\n' +
                        '🐝 RELATÓRIO VISUAL DA COLMEIA\n' +
                        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
                        '📋 RESUMO EXECUTIVO\n' +
                        '(O que vês na imagem — veredicto principal)\n\n' +
                        '🔍 ANÁLISE DETALHADA\n' +
                        '• Estado do favo: (construção, preenchimento, padrão)\n' +
                        '• Povoamento: (densidade de abelhas, distribuição)\n' +
                        '• Cria: (visibilidade, padrão de postura)\n' +
                        '• Mel/Pólen: (presença, quantidade)\n\n' +
                        '⚠️ DETEÇÕES E ALERTAS\n' +
                        '• Varroa: (presença/ausência de sinais)\n' +
                        '• Doenças: (fogo, American foulbrood, etc.)\n' +
                        '• Parasitas: (outros)\n' +
                        '• Problemas estruturais: (moldes, buracos, etc.)\n\n' +
                        '👑 ESTADO DA COLÓNIA\n' +
                        '• Saúde geral: (Crítico/Fraco/Razoável/Bom/Excelente)\n' +
                        '• Nível de atividade estimado\n' +
                        '• Sinais de enxameio\n\n' +
                        '💊 RECOMENDAÇÕES\n' +
                        '1. (Ação imediata)\n' +
                        '2. (Ação preventiva)\n' +
                        '3. (Monitorização)\n\n' +
                        '📈 ÍNDICE DE SAÚDE\n' +
                        '[████████░░] XX/100\n\n' +
                        'NÃO uses asteriscos (*) em lado nenhum da resposta.',
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
            if (!data.choices?.[0]?.message?.content) throw new Error('Resposta inválida da API de visão.');
            const diagnosis = data.choices[0].message.content;
            setMessages((prev) => [...prev, { text: `📷 ${diagnosis}`, isUser: false }]);
            saveDiagnostic({ type: 'image', result: diagnosis, image: photo }).catch(() => {});
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
                { role: 'system', content: 'És o assistente Colmeia Saudável, especialista em colmeias e bioacústica. Responde em português, de forma clara e útil para apicultores. NÃO uses asteriscos nem markdown.' },
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
                        {isListening ? (
                            <button
                                onClick={toggleListening}
                                className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl transition-all shadow-lg shadow-primary-dark/20 bg-red-600 text-white"
                            >
                                <Square className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">Parar</span>
                            </button>
                        ) : pendingAudioBlob ? (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setPendingAudioBlob(null); toggleListening(); }}
                                    className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl transition-all bg-slate-500 text-white"
                                >
                                    <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">Repetir</span>
                                </button>
                                <button
                                    onClick={async () => { const blob = pendingAudioBlob; setPendingAudioBlob(null); await analyzeAudio(blob); }}
                                    disabled={analyzing === 'audio'}
                                    className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl transition-all shadow-lg shadow-primary-dark/20 bg-primary-dark text-white disabled:opacity-50"
                                >
                                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">{analyzing === 'audio' ? 'Analisando...' : 'Analisar'}</span>
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={toggleListening}
                                className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl transition-all shadow-lg shadow-primary-dark/20 bg-primary-dark text-white"
                            >
                                <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest">Ouvir Enxame</span>
                            </button>
                        )}
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

            <div className="glass-card rounded-2xl lg:rounded-[2rem] p-4 sm:p-6 flex flex-col h-[500px] sm:h-[600px]">
                <h3 className="text-base lg:text-lg font-black text-slate-900 mb-3 lg:mb-4 flex items-center gap-3">Tirar Dúvida com IA</h3>
                <div ref={chatMessagesRef} className="bg-black/5 rounded-2xl p-3 sm:p-4 mb-3 lg:mb-4 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex ${m.isUser ? 'justify-end' : 'justify-start'}`}>
                            <div className={`${m.isUser ? 'bg-primary-dark text-white' : 'bg-white/80 text-slate-800'} p-3 sm:p-4 rounded-2xl shadow-sm max-w-[95%] text-xs font-medium whitespace-pre-wrap leading-relaxed`}>
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
