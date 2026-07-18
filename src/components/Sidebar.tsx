import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Home, Map, Thermometer, History, Settings, MoreVertical, X, Bell, BarChart3, Radio, Zap } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getUnreadAlertCount } from '../api';

const navItems = [
    { name: 'Painel Principal', path: '/', icon: LayoutDashboard },
    { name: 'Análise da IA', path: '/insights', icon: Home },
    { name: 'Atividade', path: '/activity', icon: BarChart3 },
    { name: 'Bee Radar', path: '/bee-radar', icon: Radio },
    { name: 'Mapa Global', path: '/map', icon: Map },
    { name: 'Saúde Térmica', path: '/thermal', icon: Thermometer },
];

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const load = async () => setUnreadCount(await getUnreadAlertCount());
        load();
        const interval = setInterval(load, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            <aside
                className={`
                    fixed lg:static inset-y-0 left-0 z-50
                    w-64 sidebar-premium h-screen flex flex-col py-8
                    transition-transform duration-300 ease-in-out
                    border-r border-primary-dark/30
                    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                <div className="px-8 mb-12 flex items-center justify-between">
                    <div className="flex items-center gap-3 group cursor-pointer" onClick={() => { window.location.href = '/'; onClose(); }}>
                        <span className="text-xl font-black tracking-tighter text-slate-900">
                            Colmeia
                            <span className="text-primary-dark tracking-normal font-medium"> Saudável</span>
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="lg:hidden p-1 rounded-lg hover:bg-slate-100 transition-colors"
                        aria-label="Fechar menu"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="px-4 mb-6">
                    <button
                        onClick={() => { navigate('/insights'); onClose(); }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-dark text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-primary-dark/30 hover:shadow-xl hover:scale-[1.02] transition-all"
                    >
                        <Zap className="w-4 h-4" />
                        Iniciar Diagnóstico
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.name}
                                to={item.path}
                                onClick={onClose}
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
                        to="/alerts"
                        onClick={onClose}
                        className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all group relative ${location.pathname === '/alerts'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                            }`}
                    >
                        <div className="relative">
                            <Bell className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </div>
                        <span className="text-sm font-medium tracking-wide group-hover:font-bold transition-all truncate">
                            Alertas
                            {unreadCount > 0 && (
                                <span className="ml-1 text-[10px] text-red-500 font-black">({unreadCount})</span>
                            )}
                        </span>
                    </Link>

                    <Link
                        to="/history"
                        onClick={onClose}
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
        </>
    );
};
