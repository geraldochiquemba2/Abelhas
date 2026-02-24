import React from 'react';
import { Layout } from '../components/Layout';

export const MapPage: React.FC = () => {
    return (
        <Layout>
            <div className="flex items-center gap-6 mb-12">
                <div>
                    <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                        Mapa <span className="text-primary-dark">Global</span>
                    </h1>
                    <p className="text-slate-700 font-medium text-lg">Localização em tempo real das colmeias monitoradas.</p>
                </div>
            </div>
            <div className="glass-card rounded-[3rem] p-8 h-[600px] flex items-center justify-center">
                <p className="text-slate-500 font-bold uppercase tracking-widest italic">Integração com Mapa em breve...</p>
            </div>
        </Layout>
    );
};
