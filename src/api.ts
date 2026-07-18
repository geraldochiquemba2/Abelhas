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

const KEY = 'colmeia_diagnostics';

const load = (): Diagnostic[] => {
    try {
        return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
        return [];
    }
};

const persist = (arr: Diagnostic[]) => localStorage.setItem(KEY, JSON.stringify(arr));

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
