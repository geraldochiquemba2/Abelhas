import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wifi, WifiOff, Radio, Zap } from 'lucide-react';

type Target = {
    ssid: string;
    signal: number;
    change: number;
    absChange: number;
    direction: number;
    speed: number;
    variance: number;
    isMoving: boolean;
    baseline: number;
};

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
    targets: Target[];
    networks_count: number;
    network_names?: string[];
};

type BeeDataResponse = {
    current: BeeData | null;
    history: BeeData[];
};

const stateLabels = ['LIMPO', 'POSSÍVEL', 'CONFIRMADO'];
const stateColors = ['text-green-600 bg-green-50 border-green-200', 'text-amber-600 bg-amber-50 border-amber-200', 'text-red-600 bg-red-50 border-red-200'];
const activityLabels = ['Sem atividade', 'Atividade baixa', 'Atividade moderada', 'Atividade alta'];
const activityColors = ['text-green-600', 'text-blue-600', 'text-amber-600', 'text-red-600'];

type TrailPoint = { x: number; y: number; age: number };

const RadarSweep: React.FC<{
    current: BeeData | null;
    radarActive: boolean;
}> = ({ current, radarActive }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const angleRef = useRef(0);
    const animRef = useRef<number>(0);
    const trailsRef = useRef<Map<string, TrailPoint[]>>(new Map());
    const posRef = useRef<Map<string, { x: number; y: number }>>(new Map());
    const perturbRef = useRef<Map<string, { x: number; y: number; age: number }>>(new Map());

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const size = canvas.clientWidth;
        if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
            canvas.width = size * dpr;
            canvas.height = size * dpr;
            ctx.scale(dpr, dpr);
        }

        const cx = size / 2;
        const cy = size / 2;
        const r = size / 2 - 16;

        // Dark background
        ctx.fillStyle = '#060a12';
        ctx.beginPath();
        ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
        ctx.fill();

        // Rings (distance zones)
        for (let i = 1; i <= 5; i++) {
            ctx.beginPath();
            ctx.arc(cx, cy, (r / 5) * i, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(34, 197, 94, ${0.05 + i * 0.015})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        // Crosshairs
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.06)';
        ctx.lineWidth = 0.5;
        for (let a = 0; a < Math.PI; a += Math.PI / 6) {
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            ctx.lineTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r);
            ctx.stroke();
        }

        // Compass
        ctx.font = 'bold 8px sans-serif';
        ctx.fillStyle = 'rgba(34, 197, 94, 0.35)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('0°', cx, cy - r - 7);
        ctx.fillText('180°', cx, cy + r + 9);

        // Sweep
        if (radarActive) {
            angleRef.current += 0.03;
            if (angleRef.current > Math.PI * 2) angleRef.current -= Math.PI * 2;

            try {
                const grad = ctx.createConicGradient(angleRef.current - Math.PI / 2, cx, cy);
                grad.addColorStop(0, 'rgba(34, 197, 94, 0)');
                grad.addColorStop(0.04, 'rgba(34, 197, 94, 0.25)');
                grad.addColorStop(0.08, 'rgba(34, 197, 94, 0)');
                grad.addColorStop(1, 'rgba(34, 197, 94, 0)');
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();
            } catch {}

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angleRef.current) * r, cy + Math.sin(angleRef.current) * r);
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Hive center
        const hiveColor = current?.detection_state === 2 ? '#ef4444' :
                          current?.detection_state === 1 ? '#f59e0b' : '#22c55e';
        const hp = (Date.now() % 1500) / 1500;
        ctx.beginPath();
        ctx.arc(cx, cy, 4 + hp * 12, 0, Math.PI * 2);
        ctx.strokeStyle = hiveColor;
        ctx.globalAlpha = 0.6 * (1 - hp);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = hiveColor;
        ctx.fill();

        // ── Draw targets (networks + perturbations) ──
        if (current?.targets) {
            current.targets.forEach((t, idx) => {
                const angle = (idx / Math.max(current.targets.length, 1)) * Math.PI * 2 - Math.PI / 2;
                // Signal strength maps to distance (stronger signal = closer)
                const signalNorm = Math.min(Math.abs(t.signal + 100) / 50, 1);
                const dist = r * (0.3 + (1 - signalNorm) * 0.6);

                // Target base position (where the network "lives")
                const tx = cx + Math.cos(angle) * dist;
                const ty = cy + Math.sin(angle) * dist;

                // Smooth position
                const prev = posRef.current.get(t.ssid);
                const sx = prev ? prev.x + (tx - prev.x) * 0.3 : tx;
                const sy = prev ? prev.y + (ty - prev.y) * 0.3 : ty;
                posRef.current.set(t.ssid, { x: sx, y: sy });

                // ── Static network dot (dim, reference) ──
                ctx.beginPath();
                ctx.arc(sx, sy, 3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(100, 200, 100, 0.3)';
                ctx.fill();
                ctx.font = 'bold 7px sans-serif';
                ctx.fillStyle = 'rgba(100, 200, 100, 0.4)';
                ctx.textAlign = 'center';
                ctx.fillText(t.ssid.length > 10 ? t.ssid.slice(0, 10) + '..' : t.ssid, sx, sy - 6);

                // ── Perturbation point (bright, moving) ──
                if (t.isMoving && t.absChange > 0.01) {
                    // Offset from base based on change magnitude and direction
                    const perturbDist = Math.min(t.absChange * 15, r * 0.35);
                    // Direction based on signal direction (positive = toward hive, negative = away)
                    const perturbAngle = t.direction > 0 ? angle : angle + Math.PI;
                    const px = sx + Math.cos(perturbAngle) * perturbDist;
                    const py = sy + Math.sin(perturbAngle) * perturbDist;

                    // Smooth perturbation position
                    const prevP = perturbRef.current.get(t.ssid);
                    const spx = prevP ? prevP.x + (px - prevP.x) * 0.25 : px;
                    const spy = prevP ? prevP.y + (py - prevP.y) * 0.25 : py;
                    perturbRef.current.set(t.ssid, { x: spx, y: spy, age: Date.now() });

                    // ── Trail ──
                    let trail = trailsRef.current.get(t.ssid) || [];
                    trail.push({ x: spx, y: spy, age: Date.now() });
                    if (trail.length > 25) trail.shift();
                    trailsRef.current.set(t.ssid, trail);

                    // Draw trail
                    if (trail.length > 2) {
                        ctx.beginPath();
                        ctx.moveTo(trail[0].x, trail[0].y);
                        for (let i = 1; i < trail.length; i++) {
                            ctx.lineTo(trail[i].x, trail[i].y);
                        }
                        const intensity = Math.min(t.absChange / 3, 1);
                        const trailColor = t.absChange > 2 ? `rgba(239, 68, 68, ${0.15 + intensity * 0.3})` :
                                           t.absChange > 0.5 ? `rgba(245, 158, 11, ${0.15 + intensity * 0.3})` :
                                           `rgba(34, 197, 94, ${0.1 + intensity * 0.2})`;
                        ctx.strokeStyle = trailColor;
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }

                    // Perturbation dot (bright, pulsing)
                    const pSize = 3 + Math.min(t.absChange, 4);
                    const pulse = (Date.now() % 800) / 800;

                    // Glow
                    ctx.beginPath();
                    ctx.arc(spx, spy, pSize + 5 + Math.sin(pulse * Math.PI * 2) * 3, 0, Math.PI * 2);
                    const glowColor = t.absChange > 2 ? 'rgba(239, 68, 68, 0.12)' :
                                      t.absChange > 0.5 ? 'rgba(245, 158, 11, 0.12)' :
                                      'rgba(34, 197, 94, 0.1)';
                    ctx.fillStyle = glowColor;
                    ctx.fill();

                    // Dot
                    ctx.beginPath();
                    ctx.arc(spx, spy, pSize, 0, Math.PI * 2);
                    ctx.fillStyle = t.absChange > 2 ? '#ef4444' : t.absChange > 0.5 ? '#f59e0b' : '#22c55e';
                    ctx.fill();

                    // ── Direction arrow ──
                    if (t.speed > 0.1) {
                        const arrowLen = Math.min(t.speed * 12, 20);
                        const arrowAngle = t.direction > 0 ? angle : angle + Math.PI;
                        const ax = spx + Math.cos(arrowAngle) * arrowLen;
                        const ay = spy + Math.sin(arrowAngle) * arrowLen;

                        ctx.beginPath();
                        ctx.moveTo(spx, spy);
                        ctx.lineTo(ax, ay);
                        ctx.strokeStyle = t.absChange > 2 ? '#ef4444' : t.absChange > 0.5 ? '#f59e0b' : '#88ff88';
                        ctx.lineWidth = 2;
                        ctx.stroke();

                        // Arrowhead
                        const headLen = 5;
                        const a1 = arrowAngle + Math.PI * 0.8;
                        const a2 = arrowAngle - Math.PI * 0.8;
                        ctx.beginPath();
                        ctx.moveTo(ax, ay);
                        ctx.lineTo(ax + Math.cos(a1) * headLen, ay + Math.sin(a1) * headLen);
                        ctx.moveTo(ax, ay);
                        ctx.lineTo(ax + Math.cos(a2) * headLen, ay + Math.sin(a2) * headLen);
                        ctx.stroke();
                    }

                    // Label
                    ctx.font = 'bold 8px sans-serif';
                    ctx.fillStyle = t.absChange > 2 ? '#ff6666' : t.absChange > 0.5 ? '#ffbb44' : '#88ff88';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${t.change > 0 ? '+' : ''}${t.change.toFixed(1)}dBm`, spx, spy + pSize + 10);
                }
            });

            // ── Draw connections between hive and active targets ──
            current.targets.filter(t => t.isMoving && t.absChange > 0.5).forEach(t => {
                const pos = posRef.current.get(t.ssid);
                const perturb = perturbRef.current.get(t.ssid);
                if (!pos || !perturb) return;

                ctx.beginPath();
                ctx.setLineDash([3, 4]);
                ctx.moveTo(cx, cy);
                ctx.lineTo(perturb.x, perturb.y);
                const lineColor = t.absChange > 2 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.1)';
                ctx.strokeStyle = lineColor;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.setLineDash([]);
            });
        }

        // Info
        if (current) {
            const movingCount = current.targets?.filter(t => t.isMoving).length || 0;
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(34, 197, 94, 0.5)';
            ctx.fillText(`${current.networks_count} redes`, 10, size - 18);
            if (movingCount > 0) {
                ctx.fillStyle = 'rgba(245, 158, 11, 0.7)';
                ctx.fillText(`${movingCount} perturbações`, 10, size - 6);
            }
            ctx.textAlign = 'right';
            ctx.fillStyle = 'rgba(34, 197, 94, 0.5)';
            ctx.fillText(`E: ${current.total_energy.toFixed(3)}`, size - 10, size - 18);
            ctx.fillText(`${current.time}`, size - 10, size - 6);
        }

        animRef.current = requestAnimationFrame(draw);
    }, [current, radarActive]);

    useEffect(() => {
        animRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(animRef.current);
    }, [draw]);

    // Clean old trails periodically
    useEffect(() => {
        const cleanup = setInterval(() => {
            const now = Date.now();
            trailsRef.current.forEach((trail, key) => {
                const filtered = trail.filter(p => now - p.age < 10000);
                if (filtered.length === 0) trailsRef.current.delete(key);
                else trailsRef.current.set(key, filtered);
            });
            perturbRef.current.forEach((p, key) => {
                if (now - p.age > 5000) perturbRef.current.delete(key);
            });
        }, 3000);
        return () => clearInterval(cleanup);
    }, []);

    return <canvas ref={canvasRef} className="w-full aspect-square max-w-[380px] mx-auto rounded-full" />;
};

export const BeeRadar: React.FC = () => {
    const [data, setData] = useState<BeeDataResponse | null>(null);
    const [connected, setConnected] = useState(false);
    const [energyHistory, setEnergyHistory] = useState<number[]>([]);
    const [radarState, setRadarState] = useState<'idle' | 'starting' | 'calibrating' | 'running' | 'error' | 'unavailable'>('idle');
    const [radarLog, setRadarLog] = useState('');
    const energyCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/beedata');
                const d = await res.json();
                setData(d);
                setConnected(true);
                if (d.current) {
                    setEnergyHistory(prev => [...prev, d.current.total_energy].slice(-60));
                }
            } catch { setConnected(false); }
        };

        const checkRadar = async () => {
            try {
                const res = await fetch('/api/radar/status');
                const d = await res.json();
                if (d.status === 'running') setRadarState('running');
                else if (d.status === 'calibrating') setRadarState('calibrating');
                else if (d.status === 'error') setRadarState('error');
                else if (d.status === 'stopped' && radarState !== 'idle') setRadarState('idle');
                if (d.log) setRadarLog(d.log);
            } catch {}
        };

        fetchData();
        checkRadar();
        const interval = setInterval(fetchData, 1000);
        const radarInterval = setInterval(checkRadar, 2000);
        return () => { clearInterval(interval); clearInterval(radarInterval); };
    }, []);

    const startRadar = async () => {
        setRadarState('starting');
        try {
            const res = await fetch('/api/radar/start', { method: 'POST' });
            const d = await res.json();
            if (d.status === 'unavailable') {
                setRadarState('unavailable');
                setRadarLog(d.message);
            } else if (d.status === 'started' || d.status === 'running') {
                setRadarState('calibrating');
            } else {
                setRadarState('error');
                setRadarLog(d.message || 'Erro');
            }
        } catch { setRadarState('error'); }
    };

    const stopRadar = async () => {
        try { await fetch('/api/radar/stop', { method: 'POST' }); } catch {}
        setRadarState('idle');
        setRadarLog('');
    };

    useEffect(() => {
        const canvas = energyCanvasRef.current;
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
        const maxE = Math.max(...energyHistory, 0.01);
        const barW = Math.max(2, (w / 60) - 1);
        energyHistory.forEach((e, i) => {
            const x = (i / 60) * w;
            const barH = Math.max(1, (e / maxE) * h);
            ctx.fillStyle = e > 1.5 ? '#ef4444' : e > 0.3 ? '#f59e0b' : '#22c55e';
            ctx.fillRect(x, h - barH, barW, barH);
        });
    }, [energyHistory]);

    const current = data?.current ?? null;
    const history = data?.history || [];
    const state = current?.detection_state ?? 0;
    const energy = current?.total_energy ?? 0;
    const activity = current?.bee_activity ?? 0;
    const filters = current?.filters || {};
    const targets = current?.targets || [];
    const networks = Object.keys(filters);
    const radarActive = radarState === 'running' || radarState === 'calibrating';
    const movingTargets = targets.filter(t => t.isMoving);

    return (
        <div className="space-y-4">
            {/* Header + Controls */}
            <div className="glass-card rounded-3xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Radio className="w-6 h-6 text-primary-dark" />
                        <div>
                            <span className="text-primary-dark text-xs font-black uppercase tracking-[0.3em] mb-1 block">WiFi Radar</span>
                            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Bee Radar</h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {connected ? <Wifi className="w-5 h-5 text-green-500" /> : <WifiOff className="w-5 h-5 text-red-500" />}
                        <span className={`text-xs font-bold ${connected ? 'text-green-600' : 'text-red-600'}`}>
                            {connected ? 'Online' : 'Offline'}
                        </span>
                    </div>
                </div>

                {radarState === 'unavailable' ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-center">
                        <p className="text-xs font-bold text-amber-700 mb-1">WiFi radar indisponível no servidor cloud</p>
                        <p className="text-[10px] text-amber-600">Execute a aplicação localmente no seu PC para detectar perturbações via WiFi.</p>
                    </div>
                ) : radarActive ? (
                    <button onClick={stopRadar}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-red-600/30 mb-4">
                        <WifiOff className="w-4 h-4" /> Parar Radar
                    </button>
                ) : (
                    <button onClick={startRadar} disabled={radarState === 'starting'}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-dark text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-primary-dark/30 mb-4 disabled:opacity-50">
                        {radarState === 'starting' ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> A iniciar...</>
                        ) : <><Zap className="w-4 h-4" /> Ligar Radar WiFi</>}
                    </button>
                )}

                {radarState === 'error' && radarLog && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                        <p className="text-xs font-bold text-red-700">{radarLog}</p>
                    </div>
                )}

                {radarState === 'calibrating' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-bold text-amber-700">Calibrando WiFi...</p>
                    </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/50 rounded-2xl p-3 text-center">
                        <div className={`text-3xl font-black ${activityColors[activity]}`}>{activity}</div>
                        <div className="text-[10px] font-bold text-slate-600">atividade</div>
                        <div className={`text-[9px] font-black ${activityColors[activity]}`}>{activityLabels[activity]}</div>
                    </div>
                    <div className="bg-white/50 rounded-2xl p-3 text-center">
                        <div className="text-3xl font-black text-slate-700">{energy.toFixed(3)}</div>
                        <div className="text-[10px] font-bold text-slate-600">energia</div>
                    </div>
                    <div className="bg-white/50 rounded-2xl p-3 text-center">
                        <div className={`inline-flex px-3 py-1.5 rounded-full text-xs font-black border ${stateColors[state]}`}>
                            {stateLabels[state]}
                        </div>
                        <div className="text-[10px] font-bold text-slate-600 mt-1">{movingTargets.length} perturbações</div>
                    </div>
                </div>
            </div>

            {/* Radar Visual */}
            <div className="glass-card rounded-3xl p-4 sm:p-6 relative">
                <RadarSweep current={current} radarActive={radarActive} />
                {!radarActive && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-3xl">
                        <div className="bg-black/70 px-6 py-3 rounded-2xl border border-slate-700">
                            <p className="text-slate-400 font-black text-sm uppercase tracking-widest text-center">
                                {radarState === 'idle' ? '● Parado' : radarState === 'starting' ? '● A iniciar...' : '● Erro'}
                            </p>
                            {radarState === 'idle' && !current && (
                                <p className="text-slate-500 text-[10px] text-center mt-1">Clique "Ligar Radar WiFi"</p>
                            )}
                        </div>
                    </div>
                )}
                {radarLog && radarActive && (
                    <div className="mt-3 bg-black/80 text-green-400 text-[10px] font-mono p-2 rounded-xl text-center">
                        {radarLog}
                    </div>
                )}
            </div>

            {/* Energy Chart */}
            {energyHistory.length > 0 && (
                <div className="glass-card rounded-3xl p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-600">Energia ao longo do tempo</span>
                        <span className="text-[10px] text-slate-500">{energyHistory.length} amostras</span>
                    </div>
                    <canvas ref={energyCanvasRef} className="w-full h-14 bg-black/20 rounded-xl" />
                </div>
            )}

            {/* Perturbation List */}
            {movingTargets.length > 0 && (
                <div className="glass-card rounded-3xl p-4 sm:p-6">
                    <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        Perturbações Activas ({movingTargets.length})
                    </h3>
                    <div className="space-y-2">
                        {movingTargets.map(t => (
                            <div key={t.ssid} className={`rounded-xl p-3 ${t.absChange > 2 ? 'bg-red-50 border border-red-200' : t.absChange > 0.5 ? 'bg-amber-50 border border-amber-200' : 'bg-white/50'}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-black text-slate-900">{t.ssid}</span>
                                    <span className={`text-xs font-black ${t.direction > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                        {t.direction > 0 ? '→' : '←'} {t.change > 0 ? '+' : ''}{t.change.toFixed(2)} dBm
                                    </span>
                                </div>
                                <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                                    <div>
                                        <div className="font-black text-amber-600">{t.signal}</div>
                                        <div className="text-slate-500">Sinal</div>
                                    </div>
                                    <div>
                                        <div className="font-black text-green-600">{t.baseline}</div>
                                        <div className="text-slate-500">Baseline</div>
                                    </div>
                                    <div>
                                        <div className="font-black text-red-600">{t.speed.toFixed(2)}</div>
                                        <div className="text-slate-500">Velocidade</div>
                                    </div>
                                    <div>
                                        <div className="font-black text-orange-600">{t.variance.toFixed(3)}</div>
                                        <div className="text-slate-500">Variância</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* All Networks */}
            {networks.length > 0 && (
                <div className="glass-card rounded-3xl p-4 sm:p-6">
                    <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-primary-dark" />
                        Todas as Redes ({networks.length})
                    </h3>
                    <div className="space-y-1">
                        {networks.map((ssid) => {
                            const f = filters[ssid];
                            const t = targets.find(x => x.ssid === ssid);
                            const change = current?.changes[ssid] ?? 0;
                            return (
                                <div key={ssid} className="flex items-center justify-between bg-white/50 rounded-lg px-3 py-2 text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t?.isMoving ? (t.absChange > 2 ? '#ef4444' : t.absChange > 0.5 ? '#f59e0b' : '#22c55e') : '#94a3b8' }} />
                                        <span className="font-bold text-slate-900">{ssid}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-[10px]">
                                        <span className="text-slate-500">{f?.raw?.toFixed(0)} dBm</span>
                                        <span className={`font-black ${change >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                                            {change >= 0 ? '+' : ''}{change.toFixed(2)}
                                        </span>
                                        <span className="text-slate-400">V:{f?.variance?.toFixed(2)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* History */}
            {history.length > 0 && (
                <div className="glass-card rounded-3xl p-4 sm:p-6">
                    <h3 className="text-sm font-black text-slate-900 mb-3">Histórico</h3>
                    <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                        {history.slice(0, 20).map((h, i) => (
                            <div key={i} className="flex items-center gap-2 bg-white/50 rounded-lg px-3 py-1.5 text-[10px]">
                                <span className="text-slate-500 font-mono w-14">{h.time}</span>
                                <span className={`font-black w-16 ${activityColors[h.bee_activity]}`}>{activityLabels[h.bee_activity]}</span>
                                <span className="text-slate-700 font-bold">E:{h.total_energy.toFixed(3)}</span>
                                <span className="text-slate-500 ml-auto">{h.networks_count} redes</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BeeRadar;
