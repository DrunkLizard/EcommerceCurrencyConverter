export type Currency = 'USD' | 'EUR' | 'GBP' | 'TRY' | 'JPY' | 'AUD';

export const HOME_CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'TRY'];

export type Market = { id: string; name: string; currency: Currency; tax: number; taxLabel: string };

export const MARKETS: Market[] = [
  { id: 'US', name: 'United States', currency: 'USD', tax: 0, taxLabel: 'Sales tax' },
  { id: 'EU', name: 'Germany (EU)', currency: 'EUR', tax: 19, taxLabel: 'VAT' },
  { id: 'UK', name: 'United Kingdom', currency: 'GBP', tax: 20, taxLabel: 'VAT' },
  { id: 'JP', name: 'Japan', currency: 'JPY', tax: 10, taxLabel: 'Consumption tax' },
  { id: 'AU', name: 'Australia', currency: 'AUD', tax: 10, taxLabel: 'GST' },
  { id: 'TR', name: 'Turkey', currency: 'TRY', tax: 20, taxLabel: 'KDV (VAT)' },
];

// Approximate units of each currency per 1 USD; used only to seed editable defaults.
const PER_USD: Record<Currency, number> = { USD: 1, EUR: 0.92, GBP: 0.79, TRY: 34, JPY: 150, AUD: 1.52 };

export function defaultRate(from: Currency, to: Currency): number {
  return Number((PER_USD[to] / PER_USD[from]).toPrecision(6));
}

export const pairKey = (from: Currency, to: Currency) => `${from}->${to}`;

export type Inputs = {
  price: number;
  rate: number;
  spreadPct: number;
  taxPct: number;
  feePct: number;
};

export type Result = {
  converted: number; // local price excl. tax
  taxAmount: number;
  total: number; // local price incl. tax
  spreadCost: number;
  feeCost: number;
  payoutLocal: number;
  payoutHome: number;
};

export function calculate({ price, rate, spreadPct, taxPct, feePct }: Inputs): Result {
  const converted = price * rate;
  const taxAmount = converted * (taxPct / 100);
  const total = converted + taxAmount;
  // Tax is collected for the authority; spread and fees apply to the tax-exclusive sale.
  const spreadCost = converted * (spreadPct / 100);
  const feeCost = converted * (feePct / 100);
  const payoutLocal = converted - spreadCost - feeCost;
  const payoutHome = rate > 0 ? payoutLocal / rate : 0;
  return { converted, taxAmount, total, spreadCost, feeCost, payoutLocal, payoutHome };
}

export function fmt(n: number, currency: string): string {
  if (!isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export const num = (s: string): number => {
  const v = parseFloat(s.replace(',', '.'));
  return isFinite(v) && v >= 0 ? v : 0;
};
