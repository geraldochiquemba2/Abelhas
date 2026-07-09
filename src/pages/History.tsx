import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { getDiagnostics, type Diagnostic } from '../api';

const typeLabel: Record<string, string> = {
    audio: 'Áudio',
    image: 'Imagem',
    chat: 'Chat',
    thermal: 'Térmico',
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
            <div className="flex items-center gap-6 mb-12">
                <div>
                    <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                        Histórico de <span className="text-primary-dark">Sinais</span>
                    </h1>
                    <p className="text-slate-700 font-medium text-lg">Análises guardadas neste dispositivo (temporário).</p>
                </div>
            </div>
            {items.length === 0 ? (
                <div className="glass-card rounded-3xl p-10 text-center text-slate-500 font-bold">
                    Nenhuma análise guardada ainda. Use o painel principal para analisar a colmeia.
                </div>
            ) : (
                <div className="space-y-4">
                    {items.map((it) => (
                        <div key={it.id} className="glass-card rounded-3xl p-6 flex items-start justify-between gap-4">
                            <div>
                                <h4 className="font-black text-slate-900">
                                    {typeLabel[it.type] || it.type}
                                    {it.region ? ` · ${it.region}` : ''}
                                    {it.temperature ? ` · ${it.temperature}°C` : ''}
                                </h4>
                                <p className="text-xs text-slate-500 font-bold mt-1">{formatDate(it.created_at)}</p>
                                <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{it.result}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Layout>
    );
};
