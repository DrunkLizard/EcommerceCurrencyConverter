import AsyncStorage from '@react-native-async-storage/async-storage';

const RATES_KEY = 'ecc:rates:v1';
const PRESETS_KEY = 'ecc:presets:v1';

export type Preset = {
  id: string;
  name: string;
  home: string;
  market: string;
  price: string;
  rate: string;
  spread: string;
  tax: string;
  fee: string;
};

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function write(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is best-effort; the calculator still works without it.
  }
}

export const loadRates = () => read<Record<string, string>>(RATES_KEY, {});
export const saveRates = (r: Record<string, string>) => write(RATES_KEY, r);
export const loadPresets = () => read<Preset[]>(PRESETS_KEY, []);
export const savePresets = (p: Preset[]) => write(PRESETS_KEY, p);
