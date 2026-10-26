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

/**
 * SavedTrips — list of the active profile's trips from SQLite, plus the
 * export direction of two-way sync.
 *
 * Local-first (§2.1, §7.2). Trips land here via local creation (7.1), the
 * one-way web import behind the Import tab (7.4), or an export attempt that
 * wrote web-ward. Only plain-text columns render — same display contract
 * as before.
 *
 * Web parity (saved-trips/page.tsx): header band + search + rows
 * (title, date · budget, tags) → TripDetail, plus the per-row delete
 * control the web list has (a trash button that opens a confirm modal).
 * Here the confirm is the same two-step arm TripDetail uses — a first tap
 * arms the row, a second deletes — because that is the confirm mechanism
 * already shipped on this app's destructive actions, and a modal on a
 * scrolling list would need its own dismissal contract for no gain. The
 * row stays a navigation target; only the trash control deletes.
 *
 * No dead web affordances ported (no refresh control — server-side,
 * 401-gated).
 *
 * The Export footer is the only network affordance on this screen, and it
 * is deliberately a footer rather than a per-row switch: the export is a
 * batch with a single idempotency contract, so a per-row toggle would imply
 * a per-row write. The summary line is rendered verbatim from the seam's
 * counts, never computed here — the seam owns what "exported" means.
 */
export default function SavedTrips({ navigation }: { navigation: any }) {
  const [trips, setTrips] = useState<LocalTrip[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null);
  // The delete control's arm/confirm model. Only one row is armed at a
  // time — see `savedRowDelete.nextArmedId` for why a second armed row
  // would be a footgun rather than a convenience.
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

  /**
   * Two-way sync's export direction. The screen never touches `fetch` — it
   * calls the seam, which owns the idempotency key, the per-trip failure
   * collection, and the no-delete conflict rule.
   *
   * Only a failure the seam attributes to the whole run (an unusable profile,
   * no linked token) reaches the error line; per-trip reasons arrive inside
   * `exportSummary` and are rendered as the failure list, so one bad trip
   * never masquerades as a broken export.
   */
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
      // Reload: a row may have been written locally by a prior import.
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

  /**
   * Per-row delete: first tap arms, second tap deletes. Same two-step
   * contract as TripDetail's delete button (`TripDetail.tsx:249-257`) —
   * delete must never fire on the first tap. The rules themselves live in
   * `savedRowDelete.ts` so both saved lists share one definition and the
   * "never deletes on the first tap" part is covered by headless tests.
   *
   * LOCAL ONLY. This removes the SQLite row and nothing else: there is no
   * web DELETE call here, so if this trip was already exported, the web
   * saved-trips list keeps showing it and the next import will bring it
   * back. Web-side delete propagation is a separate change with its own
   * auth and idempotency questions.
   *
   * On failure the row stays put and the reason reaches the error line
   * (same line the export failures use), because a silent no-op reads as
   * a broken control.
   */
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
        // Refresh from the seam rather than splicing state: the list is
        // already re-read on focus, and a local filter would drift from
        // what SQLite actually holds.
        await load();
      } catch (e) {
        setError(rowDeleteErrorMessage(e, ROW_DELETE_FALLBACK_REASON));
      } finally {
        // Both outcomes dispose of the model (see savedRowDelete), so the
        // tag is documentation rather than behaviour — but it stays honest:
        // claiming 'deleted' on a failure would mislabel the reason we are
        // about to show above.
        setDeleteModel(afterDelete(deleteModel, deleted ? 'deleted' : 'failed'));
      }
    },
    [deleteModel, load]
  );

  // Re-read when returning from TripDetail (delete lands back here).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const visible = useMemo(() => {
    if (trips === null) return [];
    const q = query.trim().toLowerCase();
    if (!q) return trips;
    // Web order: title, then id — plus tags (mobile-only data, same shape).
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
    // Top inset only (Home precedent): content clears the notch /
    // punch-hole camera and status bar. Bottom stays navigator-owned.
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
            // The delete control is a SIBLING of the row, never a child:
            // nested inside a TouchableOpacity its press would bubble to
            // the row and navigate instead of arming.
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
                {/* The confirm step is spelled out under the icon rather
                    than left to a color change: red-on-red is the one
                    state change a color-blind user may not see. */}
                {rowDeleteCaption(state) ? (
                  <Text className="text-[10px] font-semibold text-white">{rowDeleteCaption(state)}</Text>
                ) : null}
              </TouchableOpacity>
            </View>
          );
        }}
        // Progress + summary live below the list, matching the card/row
        // language above rather than introducing a modal. Nothing is hidden
        // behind a tap: the counts the seam returns are the whole report.
        // (A `//` comment, not `{/* */}`: this sits inside FlatList's
        // attribute list, where only line comments are legal.)
        ListFooterComponent={
          <View style={styles.exportFooter}>
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={exporting}
              accessibilityRole="button"
              accessibilityLabel="Export trips to the web"
              onPress={() => void runExport()}
            >
              {/* Gradient while idle, web `disabled:bg-gray-300` while running. */}
              <LinearGradient
                colors={exporting ? [GRADIENT.disabled.from, GRADIENT.disabled.to] : [GRADIENT.app.from, GRADIENT.app.to]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.exportGradient}
              >
                {/* The label never disappears: a spinner with no text reads as
                    a frozen UI, and the action must stay readable mid-run. */}
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
  // Row delete — the armed state mirrors CafeDetail's unsave button
  // (red wash, red border), so "armed" looks the same wherever it appears.
  deleteBtn: { borderWidth: 1, borderColor: 'transparent' },
  deleteBtnArmed: { backgroundColor: '#dc2626', borderColor: '#b91c1c' },
});
