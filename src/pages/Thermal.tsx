import React, { useState, useEffect, useRef } from 'react';
import { Layout } from '../components/Layout';
import { saveDiagnostic } from '../api';

const GROQ_CHAT_MODEL = 'llama-3.3-70b-versatile';

const REGIONS = [
    { name: 'Cabinda', lat: -5.55, lon: 12.19 },
    { name: 'Zaire', lat: -6.27, lon: 14.23 },
    { name: 'Uíge', lat: -7.58, lon: 15.02 },
    { name: 'Bengo', lat: -8.9, lon: 13.6 },
    { name: 'Luanda', lat: -8.839, lon: 13.289 },
    { name: 'Icolo e Bengo', lat: -8.65, lon: 13.95 },
    { name: 'Cuanza-Norte', lat: -9.3, lon: 14.92 },
    { name: 'Cuanza-Sul', lat: -11.21, lon: 13.84 },
    { name: 'Malanje', lat: -9.54, lon: 16.341 },
    { name: 'Lunda-Norte', lat: -7.383, lon: 20.833 },
    { name: 'Lunda-Sul', lat: -10.65, lon: 21.167 },
    { name: 'Moxico', lat: -11.78, lon: 19.92 },
    { name: 'Moxico Leste', lat: -11.88, lon: 22.85 },
    { name: 'Bié', lat: -12.38, lon: 16.93 },
    { name: 'Huambo', lat: -12.776, lon: 15.732 },
    { name: 'Benguela', lat: -12.576, lon: 13.408 },
    { name: 'Namibe', lat: -15.196, lon: 12.152 },
    { name: 'Huíla', lat: -14.917, lon: 13.492 },
    { name: 'Cunene', lat: -17.07, lon: 15.73 },
    { name: 'Cubango', lat: -14.658, lon: 17.692 },
    { name: 'Cuando', lat: -12.78, lon: 21.03 },
];

const COLS = 24;
const ROWS = 14;
const T_MIN = 20;
const T_MAX = 40;

const tempToColor = (t: number) => {
    const clamped = Math.max(T_MIN, Math.min(T_MAX, t));
    const ratio = (clamped - T_MIN) / (T_MAX - T_MIN);
    const hue = (1 - ratio) * 240;
    return `hsl(${hue}, 85%, 50%)`;
};

const generateField = (center: number, tick: number) => {
    const field: number[][] = [];
    for (let y = 0; y < ROWS; y++) {
        const row: number[] = [];
        for (let x = 0; x < COLS; x++) {
            const cx = COLS / 2;
            const cy = ROWS / 2;
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            const brood = center - dist * 1.6;
            const noise = Math.sin(tick * 0.5 + x * 0.7 + y * 0.4) * 1.2;
            row.push(brood + noise);
        }
        field.push(row);
    }
    return field;
};

const Thermal: React.FC = () => {
    const [region, setRegion] = useState(REGIONS[0]);
    const [outdoorTemp, setOutdoorTemp] = useState<number | null>(null);
    const [hiveTemp, setHiveTemp] = useState('');
    const [diagnosis, setDiagnosis] = useState('');
    const [loading, setLoading] = useState(false);
    const [center, setCenter] = useState(35);
    const [tick, setTick] = useState(0);
    const field = generateField(center, tick);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lon}&current=temperature_2m`;
                const res = await fetch(url);
                const data = await res.json();
                setOutdoorTemp(data.current?.temperature_2m ?? null);
            } catch {
                setOutdoorTemp(null);
            }
        };
        fetchWeather();
    }, [region]);

    useEffect(() => {
        timerRef.current = window.setInterval(() => setTick((t) => t + 1), 1500);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    const classify = async () => {
        const h = parseFloat(hiveTemp);
        if (isNaN(h)) return alert('Insere a temperatura interna da colmeia.');
        setCenter(h);
        setLoading(true);
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: GROQ_CHAT_MODEL,
                    temperature: 0.5,
                    messages: [
                        {
                            role: 'system',
                            content:
                                'És um especialista em apicultura. Com base na temperatura interna da colmeia e na temperatura externa da região de Angola, classifica a SAÚDE TÉRMICA (Saudável / Atenção / Crítico) e explica em até 3 frases. Colmeia saudável está tipicamente entre 34-36°C; abaixo de 32°C ou acima de 38°C indica stress, possível Varroa ou abandono. Responde em português.',
                        },
                        {
                            role: 'user',
                            content: `Região de Angola: ${region.name}. Temperatura externa atual: ${outdoorTemp ?? 'desconhecida'}°C. Temperatura interna da colmeia: ${h}°C. Classifica a saúde térmica.`,
                        },
                    ],
                }),
            });
            const data = await res.json();
            const text = data.choices[0].message.content;
            setDiagnosis(text);
            saveDiagnostic({ type: 'thermal', region: region.name, temperature: h, result: text }).catch(() => {});
        } catch (e: any) {
            alert('Erro: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className="flex items-center justify-between gap-4 sm:gap-6 mb-6 sm:mb-12 flex-wrap">
                <div>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                        Saúde <span className="text-primary-dark">Térmica</span>
                    </h1>
                    <p className="text-slate-700 font-medium text-base sm:text-lg">Classificação térmica via Groq com clima regional de Angola.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                <div className="glass-card rounded-2xl lg:rounded-[2rem] p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base lg:text-lg font-bold text-slate-900">Mapa Térmico da Colmeia</h2>
                        <span className="text-xs sm:text-sm font-bold text-primary-dark">{center.toFixed(1)} °C</span>
                    </div>
                    <div
                        className="grid rounded-xl overflow-hidden"
                        style={{
                            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                            gridTemplateRows: `repeat(${ROWS}, 1fr)`,
                            aspectRatio: `${COLS} / ${ROWS}`,
                        }}
                    >
                        {field.flatMap((row, y) =>
                            row.map((t, x) => (
                                <div key={`${x}-${y}`} style={{ backgroundColor: tempToColor(t) }} />
                            ))
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                        <span className="text-xs font-bold text-slate-600">{T_MIN}°C</span>
                        <div className="flex-1 h-3 rounded-full" style={{ background: `linear-gradient(to right, ${tempToColor(T_MIN)}, ${tempToColor((T_MIN + T_MAX) / 2)}, ${tempToColor(T_MAX)})` }} />
                        <span className="text-xs font-bold text-slate-600">{T_MAX}°C</span>
                    </div>

                    <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
                        <div>
                            <label className="text-xs font-black uppercase tracking-widest text-primary-dark">Região de Angola</label>
                            <select
                                value={region.name}
                                onChange={(e) => setRegion(REGIONS.find((r) => r.name === e.target.value)!)}
                                className="w-full mt-1 bg-white/60 border border-slate-200 rounded-2xl py-2.5 sm:py-3 px-3 sm:px-4 text-sm font-bold focus:ring-primary-dark"
                            >
                                {REGIONS.map((r) => (
                                    <option key={r.name} value={r.name}>{r.name}</option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-600 mt-1">
                                Temperatura externa atual: <span className="font-bold">{outdoorTemp !== null ? `${outdoorTemp}°C` : 'a carregar...'}</span>
                            </p>
                        </div>
                        <div>
                            <label className="text-xs font-black uppercase tracking-widest text-primary-dark">Temperatura interna da colmeia (°C)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={hiveTemp}
                                onChange={(e) => setHiveTemp(e.target.value)}
                                placeholder="ex.: 35.2"
                                className="w-full mt-1 bg-white/60 border border-slate-200 rounded-2xl py-2.5 sm:py-3 px-3 sm:px-4 text-sm font-bold focus:ring-primary-dark"
                            />
                        </div>
                        <button
                            onClick={classify}
                            disabled={loading}
                            className="w-full py-2.5 sm:py-3 rounded-xl bg-primary-dark text-white font-black text-xs uppercase tracking-widest disabled:opacity-50"
                        >
                            {loading ? 'A classificar...' : 'Classificar com Groq'}
                        </button>
                    </div>
                </div>

                <div className="glass-card rounded-2xl lg:rounded-[2rem] p-4 sm:p-6 flex flex-col">
                    <h2 className="text-base lg:text-lg font-bold text-slate-900 mb-4">Diagnóstico Térmico</h2>
                    {diagnosis ? (
                        <div className="bg-white/70 rounded-2xl p-4 sm:p-6 text-sm font-medium text-slate-800 whitespace-pre-wrap leading-relaxed flex-1">
                            {diagnosis}
                        </div>
                    ) : (
                        <div className="bg-black/5 rounded-2xl p-4 sm:p-6 text-slate-500 font-bold text-sm italic flex-1 flex items-center justify-center">
                            Insere a temperatura interna e clica em "Classificar com Groq".
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default Thermal;
