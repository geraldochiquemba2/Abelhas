import 'dotenv/config';
import https from 'https';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';
import { spawnSync } from 'child_process';
import cron from 'node-cron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

const initDb = async () => {
    if (!process.env.DATABASE_URL) {
        console.log('DATABASE_URL não definida — usa localStorage no dispositivo.');
        return;
    }
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS diagnostics (
                id SERIAL PRIMARY KEY,
                type TEXT NOT NULL,
                input TEXT,
                result TEXT,
                region TEXT,
                temperature NUMERIC,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('Tabela diagnostics pronta.');
    } catch (e) {
        console.warn('Aviso BD:', e.message);
    }
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));

let latestBeeData = null;
const beeDataHistory = [];
const phoneSignals = {};

app.post('/api/beedata', (req, res) => {
    try {
        const data = req.body;
        data.received_at = new Date().toISOString();
        latestBeeData = data;
        beeDataHistory.unshift(data);
        if (beeDataHistory.length > 500) beeDataHistory.length = 500;
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/signal', (req, res) => {
    try {
        const { deviceId, rtt, downlink, effectiveType, timestamp, ssid } = req.body || {};
        if (!deviceId) return res.status(400).json({ error: 'deviceId obrigatório' });

        if (!phoneSignals[deviceId]) {
            phoneSignals[deviceId] = { readings: [], lastActivity: null, ssid: ssid || 'unknown' };
        }
        const ps = phoneSignals[deviceId];
        ps.readings.push({ rtt, downlink, effectiveType, timestamp: timestamp || Date.now() });
        if (ps.readings.length > 120) ps.readings.shift();
        ps.lastActivity = Date.now();
        ps.ssid = ssid || ps.ssid;

        const readings = ps.readings;
        if (readings.length >= 3) {
            const recent = readings.slice(-10);
            const rttValues = recent.map(r => r.rtt).filter(r => r != null);
            const meanRtt = rttValues.reduce((a, b) => a + b, 0) / rttValues.length;
            const variance = rttValues.reduce((a, b) => a + Math.pow(b - meanRtt, 2), 0) / rttValues.length;
            const std = Math.sqrt(variance);

            const prev = readings.slice(-10, -5);
            const prevRtt = prev.map(r => r.rtt).filter(r => r != null);
            const prevMean = prevRtt.length > 0 ? prevRtt.reduce((a, b) => a + b, 0) / prevRtt.length : meanRtt;
            const direction = meanRtt - prevMean;

            const change = Math.abs(direction);
            const isSignificant = change > std * 0.5 || change > 5;

            const targets = Object.entries(phoneSignals).map(([id, ps2]) => {
                const r2 = ps2.readings.slice(-10);
                const rtt2 = r2.map(r => r.rtt).filter(r => r != null);
                const m2 = rtt2.length > 0 ? rtt2.reduce((a, b) => a + b, 0) / rtt2.length : 0;
                const p2 = ps2.readings.slice(-10, -5);
                const pRtt2 = p2.map(r => r.rtt).filter(r => r != null);
                const pM2 = pRtt2.length > 0 ? pRtt2.reduce((a, b) => a + b, 0) / pRtt2.length : m2;
                return {
                    ssid: ps2.ssid || id.slice(0, 8),
                    signal: Math.round(m2),
                    change: Math.round((m2 - pM2) * 100) / 100,
                    absChange: Math.round(Math.abs(m2 - pM2) * 100) / 100,
                    direction: Math.round((m2 - pM2) * 100) / 100,
                    speed: Math.round(Math.abs(m2 - pM2) * 100) / 100,
                    variance: Math.round(variance * 1000) / 1000,
                    isMoving: Math.abs(m2 - pM2) > 2,
                    baseline: Math.round(prevMean * 10) / 10,
                };
            });

            latestBeeData = {
                time: new Date().toLocaleTimeString('pt-AO'),
                ts: Date.now(),
                changes: { [ps.ssid]: Math.round((meanRtt - prevMean) * 100) / 100 },
                significant: isSignificant ? 1 : 0,
                total_energy: Math.round(change / 10 * 1000) / 1000,
                raw_energy: Math.round(change * 100) / 100,
                bee_activity: change > 15 ? 3 : change > 8 ? 2 : change > 3 ? 1 : 0,
                possible_bees: change > 3 ? 1 : 0,
                detection_state: change > 10 ? 2 : change > 5 ? 1 : 0,
                details: isSignificant ? [{ ssid: ps.ssid, change: Math.round((meanRtt - prevMean) * 100) / 100, abs: Math.round(change * 100) / 100 }] : [],
                filters: { [ps.ssid]: { raw: Math.round(meanRtt), filtered: Math.round(meanRtt), threshold: 2, noise: Math.round(std * 100) / 100, variance: Math.round(variance * 1000) / 1000 } },
                targets,
                networks_count: Object.keys(phoneSignals).length,
                network_names: Object.keys(phoneSignals).map(id => phoneSignals[id].ssid || id.slice(0, 8)),
                received_at: new Date().toISOString(),
            };
            beeDataHistory.unshift(latestBeeData);
            if (beeDataHistory.length > 500) beeDataHistory.length = 500;
        }

        res.json({ ok: true, readings: ps.readings.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/signal/status', (_req, res) => {
    const active = Object.entries(phoneSignals).filter(([_, ps]) => Date.now() - ps.lastActivity < 10000);
    res.json({
        devices: active.length,
        list: active.map(([id, ps]) => ({ id: id.slice(0, 8), ssid: ps.ssid, readings: ps.readings.length })),
    });
});

app.get('/api/beedata', (_req, res) => {
    res.json({
        current: latestBeeData,
        history: beeDataHistory.slice(0, 100),
    });
});

// ── WiFi Radar Engine (native Node.js) ──────────────────────────────

function pctToDbm(pct) {
    if (pct <= 0) return -100;
    if (pct >= 100) return -50;
    return -50 - 50 * Math.pow(1 - pct / 100, 1.8);
}

function scanNetworks() {
    try {
        const result = spawnSync('netsh', ['wlan', 'show', 'interfaces'], {
            timeout: 10000,
            encoding: 'latin1',
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        if (result.status !== 0 || !result.stdout) return {};
        const output = result.stdout || '';
        const networks = {};
        let ssid = null;
        for (const line of output.split('\n')) {
            const trimmed = line.trim();
            const ssidMatch = trimmed.match(/^SSID\s*:\s*(.+)/);
            if (ssidMatch) ssid = ssidMatch[1].trim();
            const signalMatch = trimmed.match(/Sinal\s*:\s*(\d+)%/) || trimmed.match(/Signal\s*:\s*(\d+)%/);
            if (signalMatch && ssid) {
                networks[ssid] = pctToDbm(parseInt(signalMatch[1]));
            }
        }
        return networks;
    } catch {
        return {};
    }
}

const isCloud = process.platform !== 'win32' || !fs.existsSync('C:\\Windows\\System32\\netsh.exe');

// Wiener filter per-SSID
class WienerFilter {
    constructor(windowSize = 20) {
        this.windowSize = windowSize;
        this.buffer = [];
    }
    filter(value) {
        this.buffer.push(value);
        if (this.buffer.length > this.windowSize) this.buffer.shift();
        if (this.buffer.length < 3) return value;
        const mean = this.buffer.reduce((a, b) => a + b, 0) / this.buffer.length;
        const variance = this.variance();
        const diffs = this.buffer.slice(1).map((v, i) => Math.abs(v - this.buffer[i]));
        const noiseVar = Math.pow(diffs.reduce((a, b) => a + b, 0) / diffs.length, 2) || 0.5;
        const gain = variance + noiseVar > 0 ? variance / (variance + noiseVar) : 0.5;
        return mean + gain * (value - mean);
    }
    variance() {
        if (this.buffer.length < 3) return 0;
        const mean = this.buffer.reduce((a, b) => a + b, 0) / this.buffer.length;
        return this.buffer.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.buffer.length;
    }
    noise() {
        if (this.buffer.length < 3) return 1;
        const diffs = this.buffer.slice(1).map((v, i) => Math.abs(v - this.buffer[i]));
        return diffs.reduce((a, b) => a + b, 0) / diffs.length || 0.5;
    }
}

class AutoThreshold {
    constructor(size = 40) {
        this.size = size;
        this.history = [];
        this.base = 0.02;
    }
    update(v) { this.history.push(v); if (this.history.length > this.size) this.history.shift(); }
    threshold() {
        if (this.history.length < 5) return this.base;
        const mean = this.history.reduce((a, b) => a + b, 0) / this.history.length;
        const std = this.history.length > 1
            ? Math.sqrt(this.history.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.history.length)
            : 0.01;
        return Math.max(this.base, mean + 0.5 * std);
    }
    isSignificant(v) { return Math.abs(v) >= this.threshold(); }
}

let radarInterval = null;
let radarStatus = 'stopped';
let radarLog = '';
const baselines = {};
const filters = {};
const thresholds = {};
const signalHistory = {};
let momentum = 0;
const energyWindow = [];
let detectionState = 0;
let stateCounter = 0;
let totalScans = 0;
let detections = 0;

function calibrate(calScans = 8) {
    const sums = {};
    const counts = {};
    for (let i = 0; i < calScans; i++) {
        const nets = scanNetworks();
        for (const [ssid, val] of Object.entries(nets)) {
            if (!sums[ssid]) { sums[ssid] = 0; counts[ssid] = 0; }
            sums[ssid] += val;
            counts[ssid]++;
        }
    }
    for (const ssid of Object.keys(sums)) {
        baselines[ssid] = sums[ssid] / counts[ssid];
        filters[ssid] = new WienerFilter(20);
        thresholds[ssid] = new AutoThreshold(60);
    }
    return Object.keys(baselines).length;
}

function analyzeOnce() {
    const networks = scanNetworks();
    totalScans++;
    if (Object.keys(networks).length === 0) return null;

    const changes = {};
    let totalEnergy = 0;
    const significant = [];
    const filterInfo = {};
    const targets = [];

    for (const [ssid, baseline] of Object.entries(baselines)) {
        if (!(ssid in networks)) continue;
        const raw = networks[ssid];
        const filt = filters[ssid].filter(raw);
        const change = Math.round((filt - baseline) * 100) / 100;
        const absChange = Math.abs(change);
        changes[ssid] = change;

        const at = thresholds[ssid];
        const thr = at.threshold();
        if (absChange < thr * 0.5) at.update(absChange);

        const sigVar = filters[ssid].variance();
        const noiseEst = filters[ssid].noise();

        // Track signal history for direction
        if (!signalHistory[ssid]) signalHistory[ssid] = [];
        signalHistory[ssid].push(raw);
        if (signalHistory[ssid].length > 20) signalHistory[ssid].shift();

        // Calculate direction from recent trend
        const hist = signalHistory[ssid];
        let direction = 0;
        let speed = 0;
        if (hist.length >= 3) {
            const recent = hist.slice(-3);
            direction = recent[2] - recent[0]; // positive = signal increasing, negative = decreasing
            speed = Math.abs(direction);
        }

        filterInfo[ssid] = {
            raw: Math.round(raw * 10) / 10,
            filtered: Math.round(filt * 10) / 10,
            threshold: Math.round(thr * 100) / 100,
            noise: Math.round(noiseEst * 100) / 100,
            variance: Math.round(sigVar * 1000) / 1000,
        };

        if (at.isSignificant(absChange)) {
            const energyContrib = absChange - thr;
            totalEnergy += Math.max(0, energyContrib);
            significant.push({ ssid, change, abs: absChange });
        } else if (sigVar > 0.1) {
            totalEnergy += Math.min(sigVar * 0.5, 1.0);
        }

        // Create target for each detected network
        targets.push({
            ssid,
            signal: Math.round(raw * 10) / 10,
            change: Math.round(change * 100) / 100,
            absChange: Math.round(absChange * 100) / 100,
            direction: Math.round(direction * 100) / 100,
            speed: Math.round(speed * 100) / 100,
            variance: Math.round(sigVar * 1000) / 1000,
            isMoving: absChange > thr || speed > 0.3,
            baseline: Math.round(baseline * 10) / 10,
        });
    }

    momentum = momentum * 0.5 + totalEnergy * 0.5;
    energyWindow.push(momentum);
    if (energyWindow.length > 5) energyWindow.shift();
    const avgEnergy = energyWindow.reduce((a, b) => a + b, 0) / energyWindow.length;

    let beeActivity = 0;
    if (avgEnergy > 0.02) beeActivity = 1;
    if (avgEnergy > 0.1) beeActivity = 2;
    if (avgEnergy > 0.5) beeActivity = 3;

    if (beeActivity > 0) {
        stateCounter = Math.min(stateCounter + 1, 3);
        detectionState = stateCounter >= 2 ? 2 : 1;
        if (detectionState === 2) detections++;
    } else {
        stateCounter = Math.max(stateCounter - 1, 0);
        if (stateCounter === 0) detectionState = 0;
    }

    const finalActivity = beeActivity;
    const now = new Date().toLocaleTimeString('pt-AO');
    return {
        time: now,
        ts: Date.now(),
        changes,
        significant: significant.length,
        total_energy: Math.round(avgEnergy * 1000) / 1000,
        raw_energy: Math.round(totalEnergy * 1000) / 1000,
        bee_activity: finalActivity,
        possible_bees: beeActivity,
        detection_state: detectionState,
        details: significant.slice(0, 10),
        filters: filterInfo,
        targets,
        networks_count: Object.keys(networks).length,
        network_names: Object.keys(networks),
    };
}

function startRadarLoop(intervalMs = 1000) {
    if (radarInterval) return;
    radarStatus = 'calibrating';
    radarLog = '[*] Calibrando WiFi...';
    console.log('[Radar] Calibrando...');

    const calibrated = calibrate(15);
    if (calibrated === 0) {
        radarStatus = 'error';
        radarLog = '[ERRO] Nenhuma rede WiFi encontrada. Verifique o adaptador WiFi.';
        console.log('[Radar] Nenhuma rede encontrada');
        return;
    }
    radarStatus = 'running';
    radarLog = `[OK] Calibrado com ${calibrated} rede(s): ${Object.keys(baselines).join(', ')}`;
    console.log(`[Radar] Calibrado: ${Object.keys(baselines).join(', ')}`);

    radarInterval = setInterval(() => {
        const data = analyzeOnce();
        if (data) {
            latestBeeData = data;
            data.received_at = new Date().toISOString();
            beeDataHistory.unshift(data);
            if (beeDataHistory.length > 500) beeDataHistory.length = 500;

            if (data.bee_activity > 0) {
                const msg = `[${data.time}] ATIVIDADE (${data.bee_activity}) - Energia: ${data.total_energy}`;
                radarLog = msg;
                console.log(`[Radar] ${msg}`);
            }
        }
    }, intervalMs);
}

function stopRadarLoop() {
    if (radarInterval) {
        clearInterval(radarInterval);
        radarInterval = null;
    }
    radarStatus = 'stopped';
    radarLog = '';
}

app.post('/api/radar/start', (_req, res) => {
    if (isCloud) {
        return res.json({ status: 'remote', message: 'Execute bee-radar.py localmente para enviar dados para este servidor.' });
    }
    if (radarStatus === 'running' || radarStatus === 'calibrating') {
        return res.json({ status: radarStatus, message: 'Radar já está activo' });
    }
    try {
        startRadarLoop(2000);
        res.json({ status: 'started', message: 'Radar WiFi iniciado' });
    } catch (e) {
        radarStatus = 'error';
        radarLog = `[ERRO] ${e.message}`;
        res.status(500).json({ status: 'error', message: e.message });
    }
});

app.post('/api/radar/stop', (_req, res) => {
    stopRadarLoop();
    res.json({ status: 'stopped', message: 'Radar parado' });
});

app.get('/api/radar/status', (_req, res) => {
    res.json({ status: radarStatus, log: radarLog });
});

// ── AI Endpoints ─────────────────────────────────────────────────────

const GROQ_URL = 'https://api.groq.com/openai/v1';
const groqHeaders = () => ({
    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    'Content-Type': 'application/json',
});

app.post('/api/transcribe', async (req, res) => {
    try {
        const { audioBase64, mime } = req.body || {};
        if (!audioBase64) return res.status(400).json({ error: 'audioBase64 obrigatório' });
        const buf = Buffer.from(audioBase64, 'base64');
        const form = new FormData();
        form.append('file', new Blob([buf], { type: mime || 'audio/webm' }), 'hive.webm');
        form.append('model', 'whisper-large-v3');
        const r = await fetch(`${GROQ_URL}/audio/transcriptions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
            body: form,
            signal: AbortSignal.timeout(60000),
        });
        res.json(await r.json());
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { messages, model } = req.body || {};
        const r = await fetch(`${GROQ_URL}/chat/completions`, {
            method: 'POST',
            headers: groqHeaders(),
            body: JSON.stringify({ model: model || 'llama-3.3-70b-versatile', messages, temperature: 0.7 }),
            signal: AbortSignal.timeout(90000),
        });
        res.json(await r.json());
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/vision', async (req, res) => {
    try {
        const { image, prompt, model } = req.body || {};
        console.log('Vision request - image length:', image?.length, 'model:', model);
        const r = await fetch(`${GROQ_URL}/chat/completions`, {
            method: 'POST',
            headers: groqHeaders(),
            body: JSON.stringify({
                model: model || 'qwen/qwen3.6-27b',
                messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image } }] }],
            }),
            signal: AbortSignal.timeout(90000),
        });
        const result = await r.json();
        console.log('Vision result:', JSON.stringify(result).substring(0, 500));
        res.json(result);
    } catch (e) {
        console.error('Vision error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/diagnostics', async (_req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM diagnostics ORDER BY created_at DESC LIMIT 200');
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/diagnostics', async (req, res) => {
    const { type, input, result, region, temperature } = req.body || {};
    if (!type || !result) return res.status(400).json({ error: 'type e result são obrigatórios' });
    try {
        const { rows } = await pool.query(
            'INSERT INTO diagnostics(type, input, result, region, temperature) VALUES($1,$2,$3,$4,$5) RETURNING *',
            [type, input ?? null, result, region ?? null, temperature ?? null]
        );
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const dist = path.join(__dirname, '..', 'dist');
app.use(express.static(dist));
app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

const port = process.env.PORT || 3001;
const certPath = path.join(__dirname, '..', 'cert.pem');
const keyPath = path.join(__dirname, '..', 'key.pem');

const startServer = (app, port) => {
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, app)
            .listen(port, '0.0.0.0', () => console.log(`HTTPS: https://0.0.0.0:${port}`));
    } else {
        import('http').then(({ default: http }) => {
            http.createServer(app).listen(port, '0.0.0.0', () => console.log(`HTTP: http://0.0.0.0:${port}`));
        });
    }
};

initDb().then(() => {
    startServer(app, port);

    // Keep Render awake: self-ping every 12 minutes
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://colmeiasaudavel.onrender.com';
    cron.schedule('*/10 * * * *', async () => {
        try {
            const res = await fetch(`${RENDER_URL}/api/health`);
            const data = await res.json();
            console.log(`[KeepAlive] ${new Date().toISOString()} — status: ${res.status}, ok: ${data.ok}`);
        } catch (e) {
            console.warn(`[KeepAlive] Falhou: ${e.message}`);
        }
    });
    console.log(`[KeepAlive] Auto-ping activo a cada 10 min → ${RENDER_URL}`);
}).catch(e => { console.error('Erro:', e); process.exit(1); });
