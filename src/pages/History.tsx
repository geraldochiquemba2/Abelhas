import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { getDiagnostics, type Diagnostic } from '../api';
import { ImageIcon, Music, MessageCircle, Thermometer } from 'lucide-react';

const typeConfig: Record<string, { label: string; icon: React.FC<any>; color: string }> = {
    audio: { label: 'Áudio', icon: Music, color: 'text-red-500' },
    image: { label: 'Imagem', icon: ImageIcon, color: 'text-blue-500' },
    chat: { label: 'Chat', icon: MessageCircle, color: 'text-green-500' },
    thermal: { label: 'Térmico', icon: Thermometer, color: 'text-orange-500' },
};

const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const HistoryPage: React.FC = () => {
    const [items, setItems] = useState<Diagnostic[]>([]);

    useEffect(() => {
        getDiagnostics().then(setItems);
    }, []);

    return (
        <Layout>
            <div className="flex items-center gap-4 sm:gap-6 mb-6 sm:mb-12">
                <div>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                        Histórico de <span className="text-primary-dark">Sinais</span>
                    </h1>
                    <p className="text-slate-700 font-medium text-base sm:text-lg">Análises guardadas neste dispositivo.</p>
                </div>
            </div>
            {items.length === 0 ? (
                <div className="glass-card rounded-2xl lg:rounded-3xl p-6 sm:p-10 text-center text-slate-500 font-bold">
                    Nenhuma análise guardada ainda. Use o painel principal para analisar a colmeia.
                </div>
            ) : (
                <div className="space-y-3 sm:space-y-4">
                    {items.map((it) => {
                        const config = typeConfig[it.type] || { label: it.type, icon: MessageCircle, color: 'text-slate-500' };
                        const Icon = config.icon;
                        return (
                            <div key={it.id} className="glass-card rounded-2xl lg:rounded-3xl p-4 sm:p-6">
                                <div className="flex items-start gap-3 sm:gap-4">
                                    {it.image ? (
                                        <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-black/10">
                                            <img src={it.image} alt="Análise" className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className={`shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-black/5 flex items-center justify-center`}>
                                            <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${config.color}`} />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-black text-slate-900 text-sm sm:text-base">
                                                {config.label}
                                            </h4>
                                            {it.region && <span className="text-xs font-bold text-slate-500">· {it.region}</span>}
                                            {it.temperature && <span className="text-xs font-bold text-slate-500">· {it.temperature}°C</span>}
                                        </div>
                                        <p className="text-[10px] sm:text-xs text-slate-500 font-bold mt-0.5">{formatDate(it.created_at)}</p>
                                        {it.input && it.type === 'audio' && (
                                            <div className="mt-2 bg-black/5 rounded-xl p-2.5 sm:p-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-primary-dark mb-1">Frequências captadas</p>
                                                <pre className="text-[10px] sm:text-xs text-slate-600 font-mono whitespace-pre-wrap leading-relaxed">{it.input}</pre>
                                            </div>
                                        )}
                                        <p className="text-xs sm:text-sm text-slate-700 mt-2 whitespace-pre-wrap leading-relaxed">{it.result}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Layout>
    );
};
