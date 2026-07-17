import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="h-screen flex honeycomb-pattern text-slate-900 font-display overflow-hidden relative">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-10 z-0 relative">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="lg:hidden fixed top-4 left-4 z-30 p-2 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/50 hover:bg-white transition-all"
                    aria-label="Abrir menu"
                >
                    <Menu className="w-6 h-6 text-slate-700" />
                </button>

                <div className="pt-12 lg:pt-0">
                    {children}
                </div>
            </main>
        </div>
    );
};
