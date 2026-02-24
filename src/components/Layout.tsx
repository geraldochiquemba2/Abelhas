import React from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div className="h-screen flex honeycomb-pattern text-slate-900 font-display overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar lg:p-10 z-0 relative">
                {children}
            </main>
        </div>
    );
};
