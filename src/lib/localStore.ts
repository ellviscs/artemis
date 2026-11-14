// Per-browser storage for demo state (pledges, citizen labels, P2P needs).
// Reads and writes never throw: private windows and blocked storage fall back to memory.
const memory = new Map<string, string>();

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key) ?? memory.get(key) ?? null;
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    const raw = memory.get(key);
    return raw === undefined ? fallback : (JSON.parse(raw) as T);
  }
}

export function writeLocal<T>(key: string, value: T): void {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // Memory copy is enough for this session.
  }
}
