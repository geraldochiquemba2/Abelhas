import 'dotenv/config';
import https from 'https';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

const initDb = async () => {
    if (!process.env.DATABASE_URL) {
        console.log('DATABASE_URL não definida — armazenamento em base de dados desativado (usa localStorage no dispositivo).');
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
        console.warn('Aviso: não foi possível iniciar a base de dados:', e.message);
    }
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));

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
        });
        res.json(await r.json());
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/vision', async (req, res) => {
    try {
        const { image, prompt, model } = req.body || {};
        const r = await fetch(`${GROQ_URL}/chat/completions`, {
            method: 'POST',
            headers: groqHeaders(),
                body: JSON.stringify({
                    model: model || 'qwen/qwen3.6-27b',
                    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image } }] }],
            }),
        });
        res.json(await r.json());
    } catch (e) {
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
        const options = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath),
        };
        https.createServer(options, app).listen(port, '0.0.0.0', () => {
            console.log(`HTTPS a correr em https://0.0.0.0:${port}`);
        });
    } else {
        import('http').then(({ default: http }) => {
            http.createServer(app).listen(port, '0.0.0.0', () => {
                console.log(`HTTP a correr em http://0.0.0.0:${port}`);
            });
        });
    }
};

initDb()
    .then(() => startServer(app, port))
    .catch((e) => { console.error('Erro ao iniciar:', e); process.exit(1); });
