import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getActiveProfileId, listTrips, exportLocalTrips, deleteTrip, type ExportSummary, type LocalTrip } from '../data';
import { formatDate, firstPayloadImage, GRADIENT } from './ui';
import { ChevronLeftIcon, TrashIcon } from './icons';
import {
  afterDelete,
  idleRowDelete,
  nextArmedId,
  rowDeleteCaption,
  rowDeleteErrorMessage,
  rowDeleteLabel,
  rowDeleteState,
  ROW_DELETE_FALLBACK_REASON,
  tapDeletes,
  tripRow,
  type RowDeleteModel,
} from './savedRowDelete';
import Thumb from './Thumb';

export default function SavedTrips({ navigation }: { navigation: any }) {
  const [trips, setTrips] = useState<LocalTrip[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null);
  const [deleteModel, setDeleteModel] = useState<RowDeleteModel>(idleRowDelete);
  const load = useCallback(async () => {
    try {
      const profileId = await getActiveProfileId();
      if (!profileId) {
        setError('Create a profile first to see saved trips.');
        setTrips([]);
        return;
      }
      const rows = await listTrips(profileId);
      setTrips(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load saved trips.');
      setTrips([]);
    }
  }, []);

  const runExport = useCallback(async () => {
    setExporting(true);
    setError(null);
    setExportSummary(null);
    try {
      const profileId = await getActiveProfileId();
      if (!profileId) {
        setError('Create a profile first to export trips.');
        return;
      }
      setExportSummary(await exportLocalTrips(profileId));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export did not complete.');
    } finally {
      setExporting(false);
    }
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  const onDeleteTrip = useCallback(
    async (trip: LocalTrip) => {
      if (!tapDeletes(deleteModel, trip.id)) {
        setDeleteModel({ ...deleteModel, armedId: nextArmedId(deleteModel, trip.id) });
        return;
      }
      setDeleteModel({ ...deleteModel, armedId: null, deletingId: trip.id });
      let deleted = false;
      try {
        const profileId = await getActiveProfileId();
        if (!profileId) throw new Error('No active profile; the row was not removed.');
        await deleteTrip(trip.id, profileId);
        deleted = true;
        await load();
      } catch (e) {
        setError(rowDeleteErrorMessage(e, ROW_DELETE_FALLBACK_REASON));
      } finally {
        setDeleteModel(afterDelete(deleteModel, deleted ? 'deleted' : 'failed'));
      }
    },
    [deleteModel, load]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const visible = useMemo(() => {
    if (trips === null) return [];
    const q = query.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter(
      (t) =>
        (t.title ?? '').toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
    );
  }, [trips, query]);

  if (trips === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F2F2F7' }} className="items-center justify-center">
        <ActivityIndicator />
        <Text className="mt-2 text-sm text-muted-foreground">Loading saved trips…</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  const countText = trips.length === 1 ? '1 trip saved' : `${trips.length} trips saved`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F2F2F7' }} edges={['top']}>
    <View style={{ flex: 1, backgroundColor: '#F2F2F7' }} className="px-4 pt-4">
      <View style={styles.band}>
        <LinearGradient
          colors={[GRADIENT.auth.pressedFrom, GRADIENT.auth.from]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.bandBody}
        >
          <View style={styles.titleRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Back to home"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => navigation.navigate('Home')}
            >
              <ChevronLeftIcon size={22} color="#ffffff" />
            </TouchableOpacity>
            <View style={styles.titleText}>
              <Text style={styles.bandTitle}>Saved trips</Text>
              <Text style={styles.bandSub}>{countText}</Text>
            </View>
          </View>
          <TextInput
            style={styles.search}
            placeholder="Search itineraries…"
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            accessibilityLabel="Search saved trips"
            returnKeyType="search"
          />
        </LinearGradient>
        <View style={styles.wave} accessible={false} importantForAccessibility="no-hide-descendants">
          <Svg width="100%" height={30} viewBox="0 0 1440 90" preserveAspectRatio="none">
            <Path
              d="M0,58 C260,88 520,90 780,62 C1040,34 1240,16 1440,38 L1440,90 L0,90 Z"
              fill="#F2F2F7"
            />
          </Svg>
        </View>
      </View>
      {error ? <Text className="mb-2 text-sm text-destructive">{error}</Text> : null}
      {visible.length === 0 && !error ? (
        <View className="items-center px-6 pt-10">
          <Text className="text-base font-semibold text-foreground">
            {query.trim() ? 'No trips match your search' : 'No saved trips yet'}
          </Text>
          <Text className="mt-1 text-center text-sm text-muted-foreground">
            {query.trim()
              ? 'Try a different title, id, or tag.'
              : 'Create one or import from the web.'}
          </Text>
        </View>
      ) : null}
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const state = rowDeleteState(deleteModel, item.id);
          const armed = state === 'armed';
          const row = tripRow(item);
          const title = item.title ?? 'Untitled trip';
          return (
            <View className="mb-3 flex-row items-center rounded-lg bg-card">
              <TouchableOpacity
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Open ${title}`}
                onPress={() => navigation.navigate('TripDetail', { id: item.id })}
                className="flex-1 flex-row gap-3 rounded-lg p-3"
              >
                <Thumb uri={firstPayloadImage(item.payload)} size={56} />
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">{title}</Text>
                  <Text className="mt-1 text-sm text-muted-foreground">
                    {[formatDate(item.date), item.budget].filter(Boolean).join(' · ') || 'No details'}
                  </Text>
                  {item.tags && item.tags.length > 0 ? (
                    <Text className="mt-1 text-xs text-muted-foreground">{item.tags.join(', ')}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={rowDeleteLabel(row, state)}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
                disabled={state === 'deleting'}
                onPress={() => void onDeleteTrip(item)}
                style={[styles.deleteBtn, armed && styles.deleteBtnArmed]}
                className="mr-2 items-center justify-center rounded-lg px-2 py-2"
              >
                <TrashIcon size={18} color={armed ? '#ffffff' : '#dc2626'} />
                {}
                {rowDeleteCaption(state) ? (
                  <Text className="text-[10px] font-semibold text-white">{rowDeleteCaption(state)}</Text>
                ) : null}
              </TouchableOpacity>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.exportFooter}>
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={exporting}
              accessibilityRole="button"
              accessibilityLabel="Export trips to the web"
              onPress={() => void runExport()}
            >
              {}
              <LinearGradient
                colors={exporting ? [GRADIENT.disabled.from, GRADIENT.disabled.to] : [GRADIENT.app.from, GRADIENT.app.to]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.exportGradient}
              >
                {}
                <Text style={styles.exportButtonText}>{exporting ? 'Exporting…' : 'Export to web'}</Text>
                {exporting ? <ActivityIndicator size="small" color="#ffffff" style={styles.exportSpinner} /> : null}
              </LinearGradient>
            </TouchableOpacity>

            {exporting ? (
              <Text className="mt-2 text-xs text-muted-foreground">Uploading local trips…</Text>
            ) : null}

            {exportSummary ? (
              <View className="mt-2 gap-1">
                <Text className="text-xs text-muted-foreground">
                  {exportSummary.exported} exported · {exportSummary.skipped} skipped ·{' '}
                  {exportSummary.failures.length} failed
                </Text>
                {exportSummary.failures.map((reason) => (
                  <Text key={reason} className="text-xs text-destructive">
                    {reason}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        }
      />
      <StatusBar style="auto" />
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  band: { marginHorizontal: -16 },
  bandBody: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 46, gap: 10 },
  wave: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 30 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  titleText: { flex: 1, gap: 2 },
  bandTitle: { fontSize: 22, fontWeight: '700', color: '#ffffff', lineHeight: 28 },
  bandSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  search: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#ffffff',
  },
  exportFooter: { paddingVertical: 12, gap: 4 },
  exportGradient: {
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  exportButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff', textAlign: 'center' },
  exportSpinner: { marginLeft: 2 },
  deleteBtn: { borderWidth: 1, borderColor: 'transparent' },
  deleteBtnArmed: { backgroundColor: '#dc2626', borderColor: '#b91c1c' },
});
