import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send } from 'lucide-react';
import { Layout } from '../components/Layout';


export const Insights: React.FC = () => {
    const [isListening, setIsListening] = useState(false);
    const [messages, setMessages] = useState<{ text: string; isUser: boolean }[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [waveHistory, setWaveHistory] = useState<number[]>([]);
    const [timer, setTimer] = useState('00:00');

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
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
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                analyserRef.current = audioContextRef.current.createAnalyser();
                const source = audioContextRef.current.createMediaStreamSource(stream);
                source.connect(analyserRef.current);

                setIsListening(true);
                startTimeRef.current = Date.now();
                setWaveHistory([]);

                const bufferLength = analyserRef.current.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                const updateVisuals = () => {
                    if (!analyserRef.current) return;
                    analyserRef.current.getByteFrequencyData(dataArray);

                    const avgValue = Array.from(dataArray).reduce((a, b) => a + b, 0) / dataArray.length;
                    const height = Math.round(Math.max(4, (avgValue / 128) * 50));

                    setWaveHistory(prev => [...prev.slice(-199), height]);

                    const now = Date.now();
                    const diff = now - startTimeRef.current;
                    const seconds = Math.floor((diff / 1000) % 60);
                    const minutes = Math.floor((diff / (1000 * 60)) % 60);
                    setTimer(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);

                    if (isListening) requestAnimationFrame(updateVisuals);
                };
                updateVisuals();

            } catch (err) {
                console.error('Erro de Áudio:', err);
                alert('Erro ao aceder ao microfone');
            }
        } else {
            setIsListening(false);
            if (audioContextRef.current) audioContextRef.current.close();
        }
    };

    const handleSendMessage = async () => {
        if (!inputValue) return;
        const userMsg = inputValue;
        setMessages(prev => [...prev, { text: userMsg, isUser: true }]);
        setInputValue('');

        // Mock AI response for now (to be replaced with real Groq call)
        setTimeout(() => {
            setMessages(prev => [...prev, {
                text: "Analisando os dados da colmeia... A frequência está estável em 240Hz, o que é um excelente sinal técnico.",
                isUser: false
            }]);
        }, 1000);
    };

    return (
        <Layout>
            <div className="flex items-center gap-6 mb-12">
                <div>
                    <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                        Análise da <span className="text-primary-dark">IA</span>
                    </h1>
                    <p className="text-slate-700 font-medium text-lg">Relatório detalhado do estado cognitivo e biológico da colmeia.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Diagnóstico */}
                <div className="glass-card rounded-[3rem] p-8 relative overflow-hidden group lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <span className="text-primary-dark text-xs font-black uppercase tracking-[0.3em] mb-1 block">Diagnóstico de Hoje</span>
                            <h2 className="text-3xl font-black text-slate-900">Status Operacional</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1 overflow-x-auto w-48 h-12 bg-black/20 rounded-xl px-2">
                                {waveHistory.map((h, i) => (
                                    <div key={i} className="w-1 bg-red-500 rounded-full shrink-0" style={{ height: `${h}px` }} />
                                ))}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <span className={`text-[10px] font-black text-primary-dark transition-opacity ${isListening ? 'opacity-100' : 'opacity-0'}`}>
                                    {timer}
                                </span>
                                <button
                                    onClick={toggleListening}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all shadow-lg shadow-primary-dark/20 group ${isListening ? 'bg-red-600' : 'bg-primary-dark'} text-white`}
                                >
                                    <Mic className={`w-5 h-5 text-white ${isListening ? 'animate-pulse' : ''}`} />
                                    <span className="text-xs font-black uppercase tracking-widest">
                                        {isListening ? 'Parar Audição' : 'Ouvir Enxame'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <p className="text-xl lg:text-2xl font-medium text-slate-800 leading-tight mb-8 italic border-l-4 border-primary-dark pl-6">
                        "Padrões de som estáveis. <span className="text-primary-dark font-black">Rainha identificada</span> por oscilações na gama de 240Hz. Atividade intensa sugere produção recorde."
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-6 bg-white/40 rounded-3xl border border-white/20">
                            <h4 className="text-primary-dark font-black text-[10px] uppercase tracking-widest mb-1">Saúde da Rainha</h4>
                            <p className="text-slate-800 text-sm font-bold">Frequência de 240Hz constante</p>
                        </div>
                        <div className="p-6 bg-white/40 rounded-3xl border border-primary-dark/30">
                            <h4 className="text-primary-dark font-bold text-[10px] uppercase tracking-widest mb-1">Ação Sugerida</h4>
                            <p className="text-xs font-black italic text-slate-900 uppercase">Otimizar coleta de própolis</p>
                        </div>
                    </div>
                </div>

                {/* Chat */}
                <div className="glass-card rounded-[3rem] p-10 flex flex-col h-[500px]">
                    <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">Tirar Dúvida com IA</h3>
                    <div ref={chatMessagesRef} className="bg-black/5 rounded-[2rem] p-6 mb-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.isUser ? 'justify-end' : 'justify-start'}`}>
                                <div className={`${m.isUser ? 'bg-primary-dark text-white' : 'bg-white/80 text-slate-800'} p-4 rounded-2xl shadow-sm max-w-[90%] text-xs font-medium`}>
                                    {m.text}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="relative flex items-center gap-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Sua dúvida..."
                            className="flex-1 bg-white/50 border-none rounded-2xl py-4 px-6 text-sm font-bold focus:ring-primary-dark"
                        />
                        <button onClick={handleSendMessage} className="p-4 bg-primary text-slate-900 rounded-2xl hover:brightness-110 transition-all">
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
};
