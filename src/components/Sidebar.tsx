import React from 'react';
import { Home, LayoutDashboard, Map, Thermometer, History, Settings, MoreVertical } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
    { name: 'Painel Principal', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Análise da IA', path: '/insights', icon: Home },
    { name: 'Mapa Global', path: '/map', icon: Map },
    { name: 'Saúde Térmica', path: '/thermal', icon: Thermometer },
];

export const Sidebar: React.FC = () => {
    const location = useLocation();

    return (
        <aside className="w-64 sidebar-premium h-screen flex flex-col py-8 z-10 transition-all duration-300 border-r border-primary-dark/30">
            <div className="px-8 mb-12 flex items-center gap-3 group cursor-pointer" onClick={() => window.location.href = '/'}>
                <span className="text-xl font-black tracking-tighter text-slate-900">
                    BeeHealth
                    <span className="text-primary-dark tracking-normal font-medium">IA</span>
                </span>
            </div>

            <nav className="flex-1 px-4 space-y-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.name}
                            to={item.path}
                            className={`flex items-center gap-4 px-6 py-3 rounded-xl transition-all group ${isActive
                                    ? 'bg-primary text-slate-900 border border-primary/20 shadow-lg shadow-primary/20'
                                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                        >
                            <Icon className={`w-5 h-5 ${isActive ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-900'}`} />
                            <span className={`text-sm tracking-wide ${isActive ? 'font-black' : 'font-bold'}`}>
                                {item.name}
                            </span>
                        </Link>
                    );
                })}

                <div className="pt-4 pb-2 px-4">
                    <div className="h-px bg-slate-100 w-full" />
                </div>

                <Link
                    to="/history"
                    className="flex items-center gap-4 px-4 py-3 text-slate-500 hover:text-primary-dark hover:bg-slate-100 rounded-xl transition-all group outline-none"
                >
                    <History className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium tracking-wide group-hover:font-bold transition-all truncate">
                        Histórico
                    </span>
                </Link>
            </nav>

            <div className="mt-auto px-4 pb-4">
                <button className="w-full flex items-center gap-4 px-4 py-3 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all mb-4 group text-left">
                    <Settings className="w-6 h-6 group-hover:rotate-45 transition-transform" />
                    <span className="text-sm font-medium">Configurações</span>
                </button>

                <div className="glass-card p-4 rounded-2xl flex items-center gap-3 cursor-pointer hover:bg-white/10 transition-all">
                    <div className="shrink-0 w-10 h-10 rounded-full border-2 border-primary/30 p-0.5 overflow-hidden">
                        <img
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAsf2QpByDYdR8w9PYRcz6HiUhRUjGPajQMp6Bw6uWw-A4fX-9mPvpNPrbPFaMo9e2Kr8HBBStsuEB2IEt_rr0nakHnXlOPMuegtGdk5T8VZxFPCG9RPEsfR7NGVg8NvptNU555CQ-b4xa3QWNXmPewWdXM547QfsRg_yzowBFlqcgMCRSNQDHYlb-lR8qttNNMG3k5BHBCiEi6m3U1PARFU0ocYsq4-TJiQkkYgxo14Of7VUdtHKnHNHlmCSRwtg9XxCdWQs_-LaSd"
                            className="w-full h-full object-cover rounded-full"
                            alt="User"
                        />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs font-black text-slate-900 truncate">Geraldo Neto</span>
                        <span className="text-[10px] text-primary-dark font-bold truncate">Desenvolvedor Premium</span>
                    </div>
                    <MoreVertical className="w-4 h-4 text-slate-400 ml-auto" />
                </div>
            </div>
        </aside>
    );
};
