import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, Trash2, Volume2, Eye, Thermometer, Shield, X } from 'lucide-react';
import { getAlerts, markAlertRead, markAllAlertsRead, deleteAlert, clearAlerts } from '../api';
import type { Alert } from '../api';

const levelStyles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    critical: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', icon: 'text-red-600' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', icon: 'text-amber-600' },
    info: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', icon: 'text-blue-600' },
};

const sourceIcon: Record<string, React.ReactNode> = {
    audio: <Volume2 className="w-4 h-4" />,
    vision: <Eye className="w-4 h-4" />,
    thermal: <Thermometer className="w-4 h-4" />,
    system: <Shield className="w-4 h-4" />,
};

const levelLabel: Record<string, string> = {
    critical: 'Crítico',
    warning: 'Aviso',
    info: 'Info',
};

export const AlertPanel: React.FC = () => {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [filter, setFilter] = useState<'all' | 'unread' | Alert['level']>('all');

    const load = async () => setAlerts(await getAlerts());
    useEffect(() => { load(); }, []);

    const filtered = alerts.filter(a => {
        if (filter === 'all') return true;
        if (filter === 'unread') return !a.read;
        return a.level === filter;
    });

    const unreadCount = alerts.filter(a => !a.read).length;

    const handleRead = async (id: string) => {
        await markAlertRead(id);
        load();
    };

    const handleReadAll = async () => {
        await markAllAlertsRead();
        load();
    };

    const handleDelete = async (id: string) => {
        await deleteAlert(id);
        load();
    };

    const handleClearAll = async () => {
        await clearAlerts();
        load();
    };

    return (
        <div className="glass-card rounded-3xl lg:rounded-[3rem] p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Bell className="w-6 h-6 text-slate-700" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </div>
                    <div>
                        <span className="text-primary-dark text-xs font-black uppercase tracking-[0.3em] mb-1 block">Alertas</span>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                            Sistema de Alertas
                            {unreadCount > 0 && <span className="text-sm ml-2 text-red-500 font-bold">({unreadCount} não lidos)</span>}
                        </h2>
                    </div>
                </div>
                <div className="flex gap-2">
                    {unreadCount > 0 && (
                        <button onClick={handleReadAll} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-dark text-white text-xs font-black">
                            <CheckCheck className="w-4 h-4" /> Marcar todos lidos
                        </button>
                    )}
                    {alerts.length > 0 && (
                        <button onClick={handleClearAll} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-black border border-red-200">
                            <Trash2 className="w-4 h-4" /> Limpar
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
                {(['all', 'unread', 'critical', 'warning', 'info'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                            filter === f
                                ? 'bg-primary-dark text-white'
                                : 'bg-white/50 text-slate-600 hover:bg-white/80'
                        }`}
                    >
                        {f === 'all' ? 'Todos' : f === 'unread' ? `Não lidos (${unreadCount})` : levelLabel[f]}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-16">
                    <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold text-sm">
                        {alerts.length === 0
                            ? 'Nenhum alerta registado. Os alertas aparecem aqui quando a IA deteta problemas.'
                            : 'Nenhum alerta neste filtro.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(alert => {
                        const style = levelStyles[alert.level];
                        return (
                            <div
                                key={alert.id}
                                className={`${style.bg} border ${style.border} rounded-2xl p-4 transition-all ${!alert.read ? 'ring-2 ring-primary-dark/20' : 'opacity-60'}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className={`mt-0.5 ${style.icon}`}>
                                            {sourceIcon[alert.source]}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className={`font-black text-sm ${style.text}`}>{alert.title}</h4>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${style.bg} border ${style.border} ${style.text}`}>
                                                    {levelLabel[alert.level]}
                                                </span>
                                                <span className="text-[9px] text-slate-400 font-bold uppercase">{alert.source}</span>
                                            </div>
                                            <p className="text-xs font-medium text-slate-600 mt-1 leading-relaxed">{alert.message}</p>
                                            <span className="text-[10px] text-slate-400 font-bold mt-2 block">
                                                {new Date(alert.created_at).toLocaleString('pt-AO')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {!alert.read && (
                                            <button
                                                onClick={() => handleRead(alert.id)}
                                                className="p-1.5 rounded-lg hover:bg-white/50 transition-colors"
                                                title="Marcar como lido"
                                            >
                                                <CheckCheck className="w-3.5 h-3.5 text-slate-500" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(alert.id)}
                                            className="p-1.5 rounded-lg hover:bg-white/50 transition-colors"
                                            title="Eliminar"
                                        >
                                            <X className="w-3.5 h-3.5 text-slate-500" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AlertPanel;
