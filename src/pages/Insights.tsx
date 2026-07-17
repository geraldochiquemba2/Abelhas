import React from 'react';
import { Layout } from '../components/Layout';
import { AnalysisPanel } from '../components/AnalysisPanel';

export const Insights: React.FC = () => {
    return (
        <Layout>
            <div className="flex items-center gap-4 sm:gap-6 mb-6 sm:mb-12">
                <div>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                        Análise da <span className="text-primary-dark">IA</span>
                    </h1>
                    <p className="text-slate-700 font-medium text-base sm:text-lg">Relatório do estado cognitivo e biológico da colmeia via Groq.</p>
                </div>
            </div>
            <AnalysisPanel />
        </Layout>
    );
};

export default Insights;
