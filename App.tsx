import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  HOME_CURRENCIES,
  MARKETS,
  calculate,
  defaultRate,
  fmt,
  num,
  pairKey,
  type Currency,
} from './src/calc';
import { fetchLiveRates, loadCachedRates, type LiveRates } from './src/rates';
import { loadPresets, loadRates, savePresets, saveRates, type Preset } from './src/storage';

const C = {
  bg: '#0B0D12',
  card: '#151922',
  border: '#262C3A',
  text: '#F4F6FB',
  muted: '#9AA3B5',
  accent: '#5EEAD4',
  accentText: '#04211D',
  danger: '#F87171',
};

function Field({
  label,
  value,
  onChange,
  suffix,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  hint?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholderTextColor={C.muted}
          selectTextOnFocus
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function Chips<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: { id: T; label: string }[];
  value: T;
  onSelect: (id: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onSelect(o.id)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.resultRow}>
      <Text style={[styles.resultLabel, strong && { color: C.text }]}>{label}</Text>
      <Text style={[styles.resultValue, strong && styles.resultStrong]}>{value}</Text>
    </View>
  );
}

export default function App() {
  const [home, setHome] = useState<Currency>('USD');
  const [marketId, setMarketId] = useState('UK');
  const [price, setPrice] = useState('100');
  const [spread, setSpread] = useState('1.5');
  const [fee, setFee] = useState('2.9');
  const [tax, setTax] = useState('20');
  const [live, setLive] = useState<LiveRates | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'live' | 'cached' | 'none'>('none');
  const [savedRates, setSavedRates] = useState<Record<string, string>>({});
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState('');

  const market = MARKETS.find((m) => m.id === marketId)!;
  const lc = market.currency;
  const key = pairKey(home, lc);
  const sameCurrency = home === lc;
  const baseRate = (from: Currency, to: Currency) =>
    from === to ? 1 : live?.base === from && live.rates[to] ? live.rates[to] : defaultRate(from, to);
  const rate = savedRates[key] ?? String(baseRate(home, lc));

  const refresh = async (base: Currency, opts: { clearOverride?: boolean } = {}) => {
    setLoading(true);
    try {
      const fresh = await fetchLiveRates(base);
      setLive(fresh);
      setStatus('live');
      if (opts.clearOverride) {
        setSavedRates((prev) => {
          const rest = { ...prev };
          delete rest[pairKey(base, lc)];
          saveRates(rest);
          return rest;
        });
      }
    } catch {
      // Offline or API down: keep whatever cached rates are already shown.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await loadCachedRates(home);
      if (cancelled) return;
      setLive(cached);
      setStatus(cached ? 'cached' : 'none');
      setLoading(true);
      try {
        const fresh = await fetchLiveRates(home);
        if (cancelled) return;
        setLive(fresh);
        setStatus('live');
      } catch {
        // Fall back to cache / built-in defaults.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [home]);

  useEffect(() => {
    (async () => {
      const [r, p] = await Promise.all([loadRates(), loadPresets()]);
      setSavedRates(r);
      setPresets(p);
    })();
  }, []);

  const pickPair = (nextHome: Currency, nextMarketId: string, resetTax: boolean) => {
    const m = MARKETS.find((x) => x.id === nextMarketId)!;
    setHome(nextHome);
    setMarketId(nextMarketId);
    if (resetTax) setTax(String(m.tax));
  };

  const onRateChange = (v: string) => {
    const next = { ...savedRates, [key]: v };
    setSavedRates(next);
    saveRates(next);
  };

  const resetRate = () => {
    const rest = { ...savedRates };
    delete rest[key];
    setSavedRates(rest);
    saveRates(rest);
  };

  const result = useMemo(
    () =>
      calculate({
        price: num(price),
        rate: num(rate),
        spreadPct: num(spread),
        taxPct: num(tax),
        feePct: num(fee),
      }),
    [price, rate, spread, tax, fee],
  );

  const savePreset = () => {
    const name = presetName.trim() || `${home} → ${market.id} #${presets.length + 1}`;
    const next = [
      { id: String(Date.now()), name, home, market: marketId, price, rate, spread, tax, fee },
      ...presets,
    ];
    setPresets(next);
    savePresets(next);
    setPresetName('');
  };

  const applyPreset = (p: Preset) => {
    setHome(p.home as Currency);
    setMarketId(p.market);
    setPrice(p.price);
    const next = { ...savedRates, [pairKey(p.home as Currency, MARKETS.find((m) => m.id === p.market)!.currency)]: p.rate };
    setSavedRates(next);
    saveRates(next);
    setSpread(p.spread);
    setTax(p.tax);
    setFee(p.fee);
  };

  const deletePreset = (id: string) => {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    savePresets(next);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          <Text style={styles.title}>Cross-Border Pricing</Text>
          <Text style={styles.subtitle}>Currency conversion, destination tax & merchant payout</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Product</Text>
            <Text style={styles.label}>Home currency</Text>
            <Chips
              options={HOME_CURRENCIES.map((c) => ({ id: c, label: c }))}
              value={home}
              onSelect={(c) => pickPair(c, marketId, false)}
            />
            <View style={{ height: 14 }} />
            <Field label="Base product price" value={price} onChange={setPrice} suffix={home} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Target market</Text>
            <Chips
              options={MARKETS.map((m) => ({ id: m.id, label: `${m.id} · ${m.currency}` }))}
              value={marketId}
              onSelect={(id) => pickPair(home, id, true)}
            />
            <View style={styles.liveRow}>
              <Pressable
                style={[styles.button, loading && { opacity: 0.6 }]}
                onPress={() => refresh(home, { clearOverride: true })}
                disabled={loading}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator size="small" color={C.accentText} />
                ) : (
                  <Text style={styles.buttonText}>Refresh Rates</Text>
                )}
              </Pressable>
              <Text style={[styles.hint, { flex: 1, marginTop: 0 }]}>
                {status === 'live' && live
                  ? `Live rates · updated ${new Date(live.fetchedAt).toLocaleString()}`
                  : status === 'cached' && live
                    ? `Offline · using last known rates from ${new Date(live.fetchedAt).toLocaleString()}`
                    : 'No live data · using built-in approximate rates'}
              </Text>
            </View>
            <View style={styles.fields}>
              <Field
                label={`Exchange rate (1 ${home} = ? ${lc})`}
                value={rate}
                onChange={onRateChange}
                hint={savedRates[key] !== undefined ? 'Custom rate (overrides live)' : 'Edit to override the live rate'}
              />
              <Field label={`${market.taxLabel} rate`} value={tax} onChange={setTax} suffix="%" />
              <Field label="FX spread / buffer" value={spread} onChange={setSpread} suffix="%" hint="Typically 1.5–2.0%" />
              <Field label="Processing fee" value={fee} onChange={setFee} suffix="%" />
            </View>
            {savedRates[key] !== undefined && !sameCurrency ? (
              <Pressable onPress={resetRate} accessibilityRole="button">
                <Text style={styles.link}>Reset to live rate</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.card, styles.resultCard]}>
            <Text style={styles.cardTitle}>Results</Text>
            <Row label="Local retail price (excl. tax)" value={fmt(result.converted, lc)} />
            <Row label={`${market.taxLabel} (${num(tax)}%)`} value={fmt(result.taxAmount, lc)} />
            <Row label="Total retail price (incl. tax)" value={fmt(result.total, lc)} strong />
            <View style={styles.divider} />
            <Row label={`FX spread (${num(spread)}%)`} value={`− ${fmt(result.spreadCost, lc)}`} />
            <Row label={`Processing fee (${num(fee)}%)`} value={`− ${fmt(result.feeCost, lc)}`} />
            <Row label="Effective merchant payout" value={fmt(result.payoutLocal, lc)} strong />
            {!sameCurrency ? <Row label="Payout in home currency" value={fmt(result.payoutHome, home)} /> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Presets</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={presetName}
                onChangeText={setPresetName}
                placeholder="Preset name (optional)"
                placeholderTextColor={C.muted}
              />
              <Pressable style={styles.button} onPress={savePreset} accessibilityRole="button">
                <Text style={styles.buttonText}>Save</Text>
              </Pressable>
            </View>
            {presets.length === 0 ? (
              <Text style={[styles.hint, { marginTop: 10 }]}>No saved presets yet.</Text>
            ) : (
              presets.map((p) => (
                <View key={p.id} style={styles.presetRow}>
                  <Pressable style={{ flex: 1 }} onPress={() => applyPreset(p)} accessibilityRole="button">
                    <Text style={styles.presetName}>{p.name}</Text>
                    <Text style={styles.hint}>
                      {p.price} {p.home} → {p.market} · rate {p.rate} · tax {p.tax}%
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => deletePreset(p.id)} accessibilityRole="button" hitSlop={8}>
                    <Text style={{ color: C.danger, fontWeight: '600' }}>Delete</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, alignItems: 'center' },
  container: { width: '100%', maxWidth: 720 },
  title: { color: C.text, fontSize: 26, fontWeight: '700', marginTop: 24 },
  subtitle: { color: C.muted, fontSize: 14, marginTop: 4, marginBottom: 16 },
  card: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  resultCard: { borderColor: C.accent },
  cardTitle: { color: C.text, fontSize: 17, fontWeight: '600', marginBottom: 12 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  field: { flexGrow: 1, flexBasis: 220, minWidth: 140 },
  label: { color: C.muted, fontSize: 13, marginBottom: 6 },
  hint: { color: C.muted, fontSize: 12, marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    backgroundColor: C.bg,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    color: C.text,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suffix: { color: C.muted, fontSize: 14, minWidth: 30 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.text, fontSize: 14 },
  chipTextActive: { color: C.accentText, fontWeight: '700' },
  link: { color: C.accent, fontSize: 13, marginTop: 12 },
  resultRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
  },
  resultLabel: { color: C.muted, fontSize: 14 },
  resultValue: { color: C.text, fontSize: 15, fontVariant: ['tabular-nums'] },
  resultStrong: { color: C.accent, fontSize: 18, fontWeight: '700' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 8 },
  button: { backgroundColor: C.accent, borderRadius: 10, minWidth: 90, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, paddingVertical: 11 },
  buttonText: { color: C.accentText, fontWeight: '700' },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  presetName: { color: C.text, fontSize: 15, fontWeight: '600' },
});
