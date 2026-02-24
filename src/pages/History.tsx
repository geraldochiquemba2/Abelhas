import React from 'react';
import { Layout } from '../components/Layout';

export const HistoryPage: React.FC = () => {
    return (
        <Layout>
            <div className="flex items-center gap-6 mb-12">
                <div>
                    <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                        Histórico de <span className="text-primary-dark">Sinais</span>
                    </h1>
                    <p className="text-slate-700 font-medium text-lg">Consulta de logs e análises passadas.</p>
                </div>
            </div>
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="glass-card rounded-3xl p-6 flex items-center justify-between">
                        <div>
                            <h4 className="font-black text-slate-900">Análise Bioacústica #{1024 + i}</h4>
                            <p className="text-xs text-slate-500 font-bold">23 de Fevereiro, 2026 - 14:30</p>
                        </div>
                        <span className="text-primary-dark font-black">98% Saudável</span>
                    </div>
                ))}
            </div>
        </Layout>
    );
};
