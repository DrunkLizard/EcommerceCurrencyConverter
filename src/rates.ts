import AsyncStorage from '@react-native-async-storage/async-storage';

const cacheKey = (base: string) => `ecc:live:v1:${base}`;

export type LiveRates = {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number; // ms epoch of the successful fetch
};

export async function loadCachedRates(base: string): Promise<LiveRates | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(base));
    return raw ? (JSON.parse(raw) as LiveRates) : null;
  } catch {
    return null;
  }
}

export async function fetchLiveRates(base: string): Promise<LiveRates> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.result !== 'success' || !json.rates) throw new Error('Unexpected response');
    const live: LiveRates = { base, rates: json.rates, fetchedAt: Date.now() };
    try {
      await AsyncStorage.setItem(cacheKey(base), JSON.stringify(live));
    } catch {
      // Cache write is best-effort.
    }
    return live;
  } finally {
    clearTimeout(timer);
  }
}
