import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, Activity, Radio } from 'lucide-react';

type BeeData = {
    time: string;
    ts: number;
    changes: Record<string, number>;
    significant: number;
    total_energy: number;
    raw_energy: number;
    bee_activity: number;
    possible_bees: number;
    detection_state: number;
    details: Array<{ ssid: string; change: number; abs: number }>;
    filters: Record<string, {
        raw: number;
        filtered: number;
        threshold: number;
        noise: number;
        variance: number;
    }>;
    networks_count: number;
};

type BeeDataResponse = {
    current: BeeData | null;
    history: BeeData[];
};

const stateLabels = ['LIMPO', 'POSSÍVEL', 'CONFIRMADO'];
const stateColors = ['text-green-600 bg-green-50 border-green-200', 'text-amber-600 bg-amber-50 border-amber-200', 'text-red-600 bg-red-50 border-red-200'];
const activityLabels = ['Sem atividade', 'Atividade baixa', 'Atividade moderada', 'Atividade alta'];
const activityColors = ['text-green-600', 'text-blue-600', 'text-amber-600', 'text-red-600'];

export const BeeRadar: React.FC = () => {
    const [data, setData] = useState<BeeDataResponse | null>(null);
    const [connected, setConnected] = useState(false);
    const [energyHistory, setEnergyHistory] = useState<number[]>([]);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/beedata');
                const d = await res.json();
                setData(d);
                setConnected(true);

                if (d.current) {
                    setEnergyHistory(prev => {
                        const next = [...prev, d.current.total_energy];
                        return next.slice(-60);
                    });
                }
            } catch {
                setConnected(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 2000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || energyHistory.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.scale(dpr, dpr);
        }

        ctx.clearRect(0, 0, w, h);

        const maxE = Math.max(...energyHistory, 0.1);
        const barW = Math.max(2, (w / 60) - 1);

        energyHistory.forEach((e, i) => {
            const x = (i / 60) * w;
            const barH = Math.max(2, (e / maxE) * h);
            ctx.fillStyle = e > 1.5 ? '#ef4444' : e > 0.3 ? '#f59e0b' : '#22c55e';
            ctx.fillRect(x, h - barH, barW, barH);
        });

        const drawAnim = () => {
            if (energyHistory.length > 0) {
                animRef.current = requestAnimationFrame(drawAnim);
            }
        };
        drawAnim();

        return () => cancelAnimationFrame(animRef.current);
    }, [energyHistory]);

    const current = data?.current;
    const history = data?.history || [];
    const state = current?.detection_state ?? 0;
    const energy = current?.total_energy ?? 0;
    const activity = current?.bee_activity ?? 0;
    const filters = current?.filters || {};

    return (
        <div className="space-y-6">
            <div className="glass-card rounded-3xl p-4 sm:p-6 lg:p-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Radio className="w-6 h-6 text-primary-dark" />
                        <div>
                            <span className="text-primary-dark text-xs font-black uppercase tracking-[0.3em] mb-1 block">WiFi Radar</span>
                            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Bee Radar</h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {connected ? (
                            <Wifi className="w-5 h-5 text-green-500" />
                        ) : (
                            <WifiOff className="w-5 h-5 text-red-500" />
                        )}
                        <span className={`text-xs font-bold ${connected ? 'text-green-600' : 'text-red-600'}`}>
                            {connected ? 'Online' : 'Offline'}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white/50 rounded-2xl p-4 text-center">
                        <div className={`text-4xl font-black ${activityColors[activity]}`}>{activity}</div>
                        <div className="text-xs font-bold text-slate-600 mt-1">atividade de abelhas</div>
                        <div className={`text-[10px] font-black mt-1 ${activityColors[activity]}`}>{activityLabels[activity]}</div>
                    </div>
                    <div className="bg-white/50 rounded-2xl p-4 text-center">
                        <div className="text-4xl font-black text-slate-700">{energy.toFixed(3)}</div>
                        <div className="text-xs font-bold text-slate-600 mt-1">energia (suavizada)</div>
                        <div className="text-[10px] text-slate-500 mt-1">raw: {(current?.raw_energy ?? 0).toFixed(3)}</div>
                    </div>
                    <div className="bg-white/50 rounded-2xl p-4 text-center">
                        <div className={`inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-black border ${stateColors[state]}`}>
                            {stateLabels[state]}
                        </div>
                        <div className="text-xs font-bold text-slate-600 mt-2">estado de deteção</div>
                    </div>
                </div>

                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-600">Energia ao longo do tempo</span>
                        <span className="text-[10px] text-slate-500">{energyHistory.length} amostras</span>
                    </div>
                    <canvas ref={canvasRef} className="w-full h-20 bg-black/20 rounded-xl" />
                </div>

                {!current && (
                    <div className="text-center py-8">
                        <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-bold text-sm">
                            Aguardando dados do bee-radar.py...
                        </p>
                        <p className="text-xs text-slate-400 mt-2">
                            Execute: <code className="bg-black/10 px-2 py-0.5 rounded">python bee-radar.py --server https://colmeiasaudavel.onrender.com</code>
                        </p>
                    </div>
                )}
            </div>

            {current && Object.keys(filters).length > 0 && (
                <div className="glass-card rounded-3xl p-4 sm:p-6 lg:p-8">
                    <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                        <Wifi className="w-5 h-5 text-primary-dark" />
                        Filtros WiFi por Rede
                    </h3>
                    <div className="space-y-3">
                        {Object.entries(filters).map(([ssid, f]) => (
                            <div key={ssid} className="bg-white/50 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-black text-slate-900">{ssid}</span>
                                    <span className="text-[10px] font-bold text-slate-500">{current.changes[ssid]?.toFixed(1) ?? 0} dBm</span>
                                </div>
                                <div className="grid grid-cols-5 gap-2 text-center">
                                    <div>
                                        <div className="text-xs font-black text-amber-600">{f.raw}</div>
                                        <div className="text-[9px] text-slate-500">Raw</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-green-600">{f.filtered}</div>
                                        <div className="text-[9px] text-slate-500">Filtrado</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-red-600">{f.threshold}</div>
                                        <div className="text-[9px] text-slate-500">Threshold</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-slate-700">{f.noise}</div>
                                        <div className="text-[9px] text-slate-500">Ruído</div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-orange-600">{f.variance}</div>
                                        <div className="text-[9px] text-slate-500">Variância</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {history.length > 0 && (
                <div className="glass-card rounded-3xl p-4 sm:p-6 lg:p-8">
                    <h3 className="text-lg font-black text-slate-900 mb-4">Histórico de Atividade</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                        {history.slice(0, 30).map((h, i) => (
                            <div key={i} className="flex items-center gap-3 bg-white/50 rounded-xl p-3 text-xs">
                                <span className="text-slate-500 font-mono w-14">{h.time}</span>
                                <span className={`font-black w-20 ${activityColors[h.bee_activity]}`}>
                                    {activityLabels[h.bee_activity]}
                                </span>
                                <span className="text-slate-700 font-bold">
                                    Energia: {h.total_energy.toFixed(3)}
                                </span>
                                <span className="text-slate-500 ml-auto">
                                    {h.networks_count} redes
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BeeRadar;
