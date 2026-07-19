export type Diagnostic = {
    id: number;
    type: string;
    input: string | null;
    result: string;
    region: string | null;
    temperature: number | null;
    image: string | null;
    created_at: string;
};

export type AlertLevel = 'critical' | 'warning' | 'info';

export type Alert = {
    id: string;
    level: AlertLevel;
    title: string;
    message: string;
    source: 'audio' | 'vision' | 'thermal' | 'system';
    diagnosticId?: number;
    read: boolean;
    created_at: string;
};

export type BeeActivity = {
    id: number;
    beesPerMin: number;
    peaksDetected: number;
    avgEnergy: number;
    durationSec: number;
    activityLevel: 'inativa' | 'baixa' | 'moderada' | 'alta' | 'muito_alta';
    created_at: string;
};

const KEY = 'colmeia_diagnostics';
const ALERT_KEY = 'colmeia_alerts';
const ACTIVITY_KEY = 'colmeia_activity';

const load = (): Diagnostic[] => {
    try {
        return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
        return [];
    }
};

const persist = (arr: Diagnostic[]) => localStorage.setItem(KEY, JSON.stringify(arr));

const loadAlerts = (): Alert[] => {
    try {
        return JSON.parse(localStorage.getItem(ALERT_KEY) || '[]');
    } catch {
        return [];
    }
};

const persistAlerts = (arr: Alert[]) => localStorage.setItem(ALERT_KEY, JSON.stringify(arr));

export async function saveDiagnostic(d: Partial<Diagnostic>): Promise<Diagnostic> {
    const item: Diagnostic = {
        id: Date.now(),
        type: d.type || 'generic',
        input: d.input ?? null,
        result: d.result || '',
        region: d.region ?? null,
        temperature: d.temperature ?? null,
        image: d.image ?? null,
        created_at: new Date().toISOString(),
    };
    const arr = load();
    arr.unshift(item);
    persist(arr.slice(0, 200));
    return item;
}

export async function getDiagnostics(): Promise<Diagnostic[]> {
    return load();
}

export async function saveAlert(a: Omit<Alert, 'id' | 'read' | 'created_at'>): Promise<Alert> {
    const alert: Alert = {
        ...a,
        id: crypto.randomUUID(),
        read: false,
        created_at: new Date().toISOString(),
    };
    const arr = loadAlerts();
    arr.unshift(alert);
    persistAlerts(arr.slice(0, 100));
    return alert;
}

export async function getAlerts(): Promise<Alert[]> {
    return loadAlerts();
}

export async function markAlertRead(id: string): Promise<void> {
    const arr = loadAlerts();
    const alert = arr.find(a => a.id === id);
    if (alert) {
        alert.read = true;
        persistAlerts(arr);
    }
}

export async function markAllAlertsRead(): Promise<void> {
    const arr = loadAlerts();
    arr.forEach(a => a.read = true);
    persistAlerts(arr);
}

export async function deleteAlert(id: string): Promise<void> {
    const arr = loadAlerts().filter(a => a.id !== id);
    persistAlerts(arr);
}

export async function clearAlerts(): Promise<void> {
    persistAlerts([]);
}

export async function getUnreadAlertCount(): Promise<number> {
    return loadAlerts().filter(a => !a.read).length;
}

export async function requestNotificationPermission(): Promise<boolean> {
    try {
        if (!('Notification' in window)) return false;
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') return false;
        const result = await Notification.requestPermission();
        return result === 'granted';
    } catch {
        return false;
    }
}

export function showPushNotification(title: string, body: string, level: AlertLevel) {
    try {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const icon = level === 'critical' ? '🚨' : level === 'warning' ? '⚠️' : 'ℹ️';
        new Notification(`${icon} ${title}`, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: `alert-${Date.now()}`,
            requireInteraction: level === 'critical',
        });
    } catch { /* iOS Safari - sem notificações */ }
}

export function analyzeDiagnosticForAlerts(result: string, source: 'audio' | 'vision' | 'thermal'): Omit<Alert, 'id' | 'read' | 'created_at'>[] {
    const alerts: Omit<Alert, 'id' | 'read' | 'created_at'>[] = [];
    const lower = result.toLowerCase();

    const queenAbsent = lower.includes('rainha ausente') || lower.includes('queen absent') ||
        lower.includes('tooting') || lower.includes('piping') ||
        (lower.includes('rainha') && (lower.includes('ausente') || lower.includes('não detetada') || lower.includes('não detectada')));
    if (queenAbsent) {
        alerts.push({
            level: 'critical',
            title: 'Rainha Ausente',
            message: `Detetados sinais de ausência de rainha na análise por ${source === 'audio' ? 'áudio' : source === 'vision' ? 'imagem' : 'temperatura'}.`,
            source,
        });
    }

    const swarming = lower.includes('enxameio') || lower.includes('swarming') ||
        lower.includes('enxame') || lower.includes('swarm');
    if (swarming) {
        alerts.push({
            level: 'warning',
            title: 'Risco de Enxameio',
            message: `Sinais de enxameio detetados na análise por ${source}.`,
            source,
        });
    }

    const varroa = lower.includes('varroa') || lower.includes('ácaro');
    if (varroa) {
        alerts.push({
            level: 'critical',
            title: 'Varroa Detetada',
            message: `Presença de Varroa detetada na análise por ${source}.`,
            source,
        });
    }

    const highTemp = lower.includes('temperatura elevada') || lower.includes('temperatura alta') ||
        lower.includes('overheating') || lower.includes('calor excessivo');
    if (highTemp) {
        alerts.push({
            level: 'warning',
            title: 'Temperatura Elevada',
            message: 'Temperatura interna da colmeia acima do normal.',
            source,
        });
    }

    const disease = lower.includes('doença') || lower.includes('disease') ||
        lower.includes('foulbrood') || lower.includes('mold') ||
        lower.includes('nísel') || lower.includes('nosema');
    if (disease) {
        alerts.push({
            level: 'critical',
            title: 'Doença Detetada',
            message: `Sinais de doença identificados na análise por ${source}.`,
            source,
        });
    }

    const stress = lower.includes('stress') || lower.includes('stressado') ||
        lower.includes('agitado') || lower.includes('nervoso');
    if (stress) {
        alerts.push({
            level: 'warning',
            title: 'Stress na Colónia',
            message: `Sinais de stress detetados na análise por ${source}.`,
            source,
        });
    }

    const healthScore = result.match(/\[.*?\]\s*(\d+)\/100/);
    if (healthScore) {
        const score = parseInt(healthScore[1]);
        if (score <= 30) {
            alerts.push({
                level: 'critical',
                title: 'Saúde Crítica',
                message: `Índice de saúde: ${score}/100 — intervenção urgente necessária.`,
                source,
            });
        } else if (score <= 60) {
            alerts.push({
                level: 'warning',
                title: 'Saúde Desfavorável',
                message: `Índice de saúde: ${score}/100 — monitorizar de perto.`,
                source,
            });
        }
    }

    return alerts;
}

const loadActivity = (): BeeActivity[] => {
    try {
        return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
    } catch {
        return [];
    }
};

const persistActivity = (arr: BeeActivity[]) => localStorage.setItem(ACTIVITY_KEY, JSON.stringify(arr));

export async function saveBeeActivity(a: BeeActivity): Promise<BeeActivity> {
    const arr = loadActivity();
    arr.unshift(a);
    persistActivity(arr.slice(0, 500));
    return a;
}

export async function getActivityHistory(): Promise<BeeActivity[]> {
    return loadActivity();
}

export async function clearActivityHistory(): Promise<void> {
    persistActivity([]);
}
