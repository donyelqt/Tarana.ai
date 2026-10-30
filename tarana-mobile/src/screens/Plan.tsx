import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GradientCTA } from './ui';
import { generateItinerary } from '../data';
import { downloadModel, getModelStatus, type ModelStatus } from '../llm/modelManager';
import { CITY_CONFIGS, type CityId } from 'tarana-web/data/cityConfig';

const BLUE = '#0066FF';

const PLAN_CITIES: CityId[] = ['baguio', 'cebu', 'manila', 'davao', 'boracay', 'el_nido'];
const INTERESTS = ['Food', 'Nature', 'Culture', 'Adventure', 'Cafes', 'History', 'Nightlife', 'Shopping'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const DOWNLOAD_REASON =
  'This device has no planning model yet. Tarana plans offline, so the model lives on your phone instead of a server.';
const PREPARE_REASON =
  'This build cannot run the on-device model (llama.rn is a native module; a development build is required).';

const MEGABYTE = 1024 * 1024;

function megabytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  return `${(bytes / MEGABYTE).toFixed(0)} MB`;
}

export default function Plan() {
  const [city, setCity] = useState<CityId>('baguio');
  const [budget, setBudget] = useState('');
  const [pax, setPax] = useState(2);
  const [days, setDays] = useState(3);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [interests, setInterests] = useState<string[]>(['Food']);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [model, setModel] = useState<ModelStatus | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [downloading, setDownloading] = useState<{ fraction: number; bytesDownloaded: number; bytesTotal: number } | null>(
    null
  );

  const toggleInterest = (tag: string) => {
    setInterests((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    setPending(null);
  };

  const checkModel = async (): Promise<boolean> => {
    setModelLoading(true);
    try {
      const status = await getModelStatus();
      setModel(status);
      return status.state === 'ready';
    } catch {
      setPending(DOWNLOAD_REASON);
      return false;
    } finally {
      setModelLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading({ fraction: 0, bytesDownloaded: 0, bytesTotal: 0 });
    setProgress('Downloading the planning model…');
    setPending(null);
    try {
      await downloadModel((fraction, bytesDownloaded, bytesTotal) => {
        setDownloading({ fraction, bytesDownloaded, bytesTotal });
        setProgress(`Downloading the planning model… ${Math.round(fraction * 100)}%`);
      });
      const status = await getModelStatus();
      setModel(status);
      setProgress(null);
    } catch (e) {
      setDownloading(null);
      setPending(e instanceof Error ? `The download stopped: ${e.message}` : 'The download stopped before it finished.');
    } finally {
      setDownloading(null);
    }
  };

  const handleGenerate = async () => {
    setError(null);
    setPending(null);
    setProgress(null);
    const n = parseInt(budget.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a trip budget in pesos.');
      return;
    }
    if (!DATE_RE.test(start.trim()) || !DATE_RE.test(end.trim())) {
      setError('Dates must look like 2026-10-03 (YYYY-MM-DD).');
      return;
    }
    if (interests.length === 0) {
      setError('Pick at least one interest.');
      return;
    }
    const summary =
      `${CITY_CONFIGS[city].name} · ₱${n} · ${pax} ${pax === 1 ? 'person' : 'people'} · ` +
      `${days} ${days === 1 ? 'day' : 'days'} · ${interests.join(', ')}`;

    if (model !== null && model.state === 'unsupported') {
      setPending(`${summary}\n\n${PREPARE_REASON}`);
      return;
    }
    setLoading(true);
    try {
      const ready = await checkModel();
      if (!ready) {
        setPending(`${summary}\n\n${DOWNLOAD_REASON}`);
        return;
      }
      await generateItinerary(
        {
          city,
          budget: n,
          pax,
          days,
          startDate: start.trim(),
          endDate: end.trim(),
          interests,
        },
        setProgress
      );
      setProgress(null);
    } catch (e) {
      setProgress(null);
      setPending(`${summary}\n\n${e instanceof Error ? e.message : 'Generation is unavailable.'}`);
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || modelLoading || downloading !== null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Plan my trip</Text>

      <Text style={styles.label}>Destination</Text>
      <View style={styles.pills}>
        {PLAN_CITIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.pill, city === c && styles.pillActive]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: city === c }}
            accessibilityLabel={`Destination ${CITY_CONFIGS[c].name}`}
            onPress={() => {
              setCity(c);
              setPending(null);
            }}
          >
            <Text style={[styles.pillText, city === c && styles.pillTextActive]}>{CITY_CONFIGS[c].name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Budget total (₱)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 5000"
        value={budget}
        onChangeText={(t) => {
          setBudget(t);
          setPending(null);
        }}
        keyboardType="number-pad"
        returnKeyType="done"
        placeholderTextColor="#9ca3af"
        accessibilityLabel="Trip budget total in pesos"
      />

      <Text style={styles.label}>People</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={styles.stepBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Fewer people"
          onPress={() => setPax((p) => Math.max(1, p - 1))}
        >
          <Text style={styles.stepText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepValue}>{pax}</Text>
        <TouchableOpacity
          style={styles.stepBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="More people"
          onPress={() => setPax((p) => Math.min(20, p + 1))}
        >
          <Text style={styles.stepText}>+</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Days</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={styles.stepBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Fewer days"
          onPress={() => setDays((d) => Math.max(1, d - 1))}
        >
          <Text style={styles.stepText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepValue}>{days}</Text>
        <TouchableOpacity
          style={styles.stepBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="More days"
          onPress={() => setDays((d) => Math.min(14, d + 1))}
        >
          <Text style={styles.stepText}>+</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Start date</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={start}
        onChangeText={(t) => {
          setStart(t);
          setPending(null);
        }}
        autoCapitalize="none"
        placeholderTextColor="#9ca3af"
        accessibilityLabel="Trip start date"
      />

      <Text style={styles.label}>End date</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={end}
        onChangeText={(t) => {
          setEnd(t);
          setPending(null);
        }}
        autoCapitalize="none"
        placeholderTextColor="#9ca3af"
        accessibilityLabel="Trip end date"
      />

      <Text style={styles.label}>Interests</Text>
      <View style={styles.pills}>
        {INTERESTS.map((tag) => (
          <TouchableOpacity
            key={tag}
            style={[styles.pill, interests.includes(tag) && styles.pillActive]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: interests.includes(tag) }}
            accessibilityLabel={`Interest ${tag}`}
            onPress={() => toggleInterest(tag)}
          >
            <Text style={[styles.pillText, interests.includes(tag) && styles.pillTextActive]}>{tag}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {downloading ? (
        <View style={styles.progressBox}>
          <Text style={styles.progressText}>{progress ?? 'Downloading the planning model…'}</Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(100, Math.max(0, Math.round(downloading.fraction * 100)))}%` },
              ]}
            />
          </View>
          <Text style={styles.progressMeta}>
            {downloading.bytesTotal > 0
              ? `${megabytes(downloading.bytesDownloaded)} of ${megabytes(downloading.bytesTotal)}`
              : 'Starting…'}
          </Text>
        </View>
      ) : progress && loading ? (
        <View style={styles.progressBox}>
          <ActivityIndicator color={BLUE} />
          <Text style={styles.progressText}>{progress}</Text>
        </View>
      ) : null}

      {pending ? (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingTitle}>Almost there</Text>
          <Text style={styles.pendingText}>{pending}</Text>
        </View>
      ) : null}

      {model !== null && model.state !== 'ready' && !busy ? (
        <TouchableOpacity
          style={styles.downloadBtn}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Download the planning model"
          onPress={handleDownload}
        >
          <Text style={styles.downloadText}>Download planning model{model.state === 'downloading-incomplete' ? ' (resume)' : ''}</Text>
        </TouchableOpacity>
      ) : null}

      <GradientCTA
        variant="app"
        title="Generate itinerary"
        loadingTitle="Checking…"
        loading={busy}
        onPress={handleGenerate}
        accessibilityLabel="Generate itinerary"
      />
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { paddingHorizontal: 24, paddingVertical: 24, gap: 10 },
  title: { fontSize: 22, fontWeight: '600', color: '#111827', lineHeight: 28 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, color: '#111827', fontVariant: ['tabular-nums'] },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe' },
  pillActive: { backgroundColor: BLUE, borderColor: BLUE },
  pillText: { color: BLUE, fontSize: 13, fontWeight: '500' },
  pillTextActive: { color: '#ffffff' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 22, color: BLUE, fontWeight: '600' },
  stepValue: { fontSize: 20, fontWeight: '700', color: '#111827', minWidth: 32, textAlign: 'center', fontVariant: ['tabular-nums'] },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 10 },
  errorText: { color: '#dc2626', fontSize: 13 },
  progressBox: { backgroundColor: '#eff6ff', borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: '#dbeafe', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  progressText: { fontSize: 13, color: '#374151', flexGrow: 1, flexBasis: '100%' },
  progressMeta: { fontSize: 12, color: '#6b7280' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#dbeafe', flexBasis: '100%', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: BLUE },
  pendingBox: { backgroundColor: '#eff6ff', borderRadius: 16, padding: 16, gap: 6, borderWidth: 1, borderColor: '#dbeafe' },
  pendingTitle: { fontSize: 15, fontWeight: '600', color: BLUE },
  pendingText: { fontSize: 13, color: '#374151', lineHeight: 19 },
  downloadBtn: { backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: BLUE, alignItems: 'center' },
  downloadText: { color: BLUE, fontSize: 14, fontWeight: '600' },
});
