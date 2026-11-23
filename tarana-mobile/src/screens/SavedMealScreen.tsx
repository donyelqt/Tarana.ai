import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { findCafe } from '../data/catalog';
import { getActiveProfileId, listMeals, spotMapsUrl, type LocalMeal } from '../data';
import type { MealNote } from '../data/notes';
import {
  cafeCoordinates,
  mealCardDishCount,
  mealCardItems,
  mealCardTotal,
  mealCardValidUntil,
  type MealCardItem,
} from './savedMealDetail';
import { MapPinIcon } from './icons';
import { formatPHP } from './ui';
import { mealNoteSummary } from './mealNoteCard';
import { noteEditorError, noteEditorFields, type NoteEditorModel } from './mealNoteEditor';
import { loadMealNote, saveMealNoteFor } from './mealNoteScreenContract';

const BLUE = '#0066FF';

export default function SavedMealDetail({
  route,
}: {
  route: { params?: { id?: string } };
}) {
  const id = route?.params?.id ?? '';
  const [meal, setMeal] = useState<LocalMeal | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<MealNote | null>(null);
  const [editor, setEditor] = useState<NoteEditorModel>({
    open: false,
    phase: 'idle',
    draft: { title: '', notes: '' },
  });
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteLoadFailed, setNoteLoadFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const profileId = await getActiveProfileId();
      if (!profileId) throw new Error('Create a profile first to view saved meals.');
      const rows = await listMeals(profileId);
      setMeal(rows.find((m) => m.id === id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load this meal.');
    } finally {
      setLoaded(true);
    }
  }, [id]);

  const loadNote = useCallback(async () => {
    if (!id) return;
    try {
      setNote(await loadMealNote(id));
    } catch {
      setNoteLoadFailed(true);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadNote();
  }, [loadNote]);

  const openEditor = () => {
    setNoteError(null);
    setEditor({ open: true, phase: 'editing', draft: noteEditorFields(note) });
  };

  const closeEditor = () => {
    if (editor.phase === 'saving') return;
    setNoteError(null);
    setEditor({ open: false, phase: 'idle', draft: { title: '', notes: '' } });
  };

  const commitNote = async () => {
    const problem = noteEditorError(editor.draft);
    if (problem) {
      setNoteError(problem);
      return;
    }
    if (!id) return;
    setNoteError(null);
    setEditor((current) => ({ ...current, phase: 'saving' }));
    try {
      const saved = await saveMealNoteFor(id, editor.draft);
      setNote(saved);
      setNoteLoadFailed(false);
      setEditor({ open: false, phase: 'idle', draft: { title: '', notes: '' } });
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : 'The note was not saved.');
      setEditor((current) => ({ ...current, phase: 'editing' }));
    }
  };

  if (!loaded) {
    return (
      <View style={styles.center}>
        <StatusBar style="auto" />
        <ActivityIndicator color={BLUE} />
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <StatusBar style="auto" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={styles.center}>
        <StatusBar style="auto" />
        <Text style={styles.errorText}>This saved meal is no longer available.</Text>
      </View>
    );
  }

  const items: MealCardItem[] = mealCardItems(meal.items);
  const cafe = findCafe(meal.cafe_name);
  const coords = cafeCoordinates(cafe);
  const mapsUrl = coords ? spotMapsUrl(coords.lat, coords.lon) : null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <StatusBar style="auto" />
      {cafe ? <Text style={styles.eyebrow}>{cafe.cuisine}</Text> : null}
      <Text style={styles.title}>{meal.cafe_name}</Text>

      <Text style={styles.meta}>
        {[meal.meal_type, formatPHP(meal.price)].filter(Boolean).join(' · ') || 'Saved'}
      </Text>

      <TouchableOpacity
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`View ${meal.cafe_name} on the map`}
        onPress={() => {
          if (mapsUrl) void Linking.openURL(mapsUrl);
        }}
        style={styles.mapBtn}
      >
        <View style={styles.mapRow}>
          <MapPinIcon size={18} color={BLUE} />
          {meal.location ? <Text style={styles.mapText}>{meal.location}</Text> : null}
        </View>
      </TouchableOpacity>

      {meal.good_for.length > 0 ? (
        <Text style={styles.goodFor}>Good for {meal.good_for.join(' · ')}</Text>
      ) : null}

      <View style={styles.noteCard}>
        {editor.open ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.noteForm}
          >
            <Text style={styles.noteLabel}>Nickname</Text>
            <TextInput
              style={styles.noteInput}
              value={editor.draft.title}
              onChangeText={(title) =>
                setEditor((current) => ({ ...current, draft: { ...current.draft, title } }))
              }
              placeholder="What do you call this meal?"
              accessibilityLabel="Meal note nickname"
              maxLength={220}
              editable={editor.phase !== 'saving'}
            />
            <Text style={styles.noteLabel}>Note</Text>
            <TextInput
              style={[styles.noteInput, styles.noteInputMultiline]}
              value={editor.draft.notes}
              onChangeText={(notes) =>
                setEditor((current) => ({ ...current, draft: { ...current.draft, notes } }))
              }
              placeholder="Anything to remember for next time?"
              accessibilityLabel="Meal note"
              multiline
              numberOfLines={4}
              maxLength={5200}
              editable={editor.phase !== 'saving'}
            />
            {noteError ? (
              <Text style={styles.noteError} accessibilityRole="alert">
                {noteError}
              </Text>
            ) : null}
            <View style={styles.noteActions}>
              <TouchableOpacity
                style={[styles.noteSaveBtn, editor.phase === 'saving' && styles.noteBtnDisabled]}
                activeOpacity={0.85}
                disabled={editor.phase === 'saving'}
                accessibilityRole="button"
                accessibilityLabel="Save note"
                onPress={() => void commitNote()}
              >
                <Text style={styles.noteSaveText}>
                  {editor.phase === 'saving' ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.noteCancelBtn}
                activeOpacity={0.85}
                disabled={editor.phase === 'saving'}
                accessibilityRole="button"
                accessibilityLabel="Cancel note edit"
                onPress={closeEditor}
              >
                <Text style={styles.noteCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        ) : (
          <>
            <Text style={styles.noteLabel}>Your note</Text>
            {mealNoteSummary(note) ? (
              <Text style={styles.noteBody}>{mealNoteSummary(note)}</Text>
            ) : (
              <Text style={styles.noteEmpty}>
                {noteLoadFailed ? 'Your note could not be loaded.' : 'No note yet.'}
              </Text>
            )}
            {noteLoadFailed ? (
              <TouchableOpacity
                style={styles.noteEditBtn}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Retry loading note"
                onPress={() => {
                  setNoteLoadFailed(false);
                  void loadNote();
                }}
              >
                <Text style={styles.noteEditText}>Retry</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.noteEditBtn}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Edit note"
                onPress={openEditor}
              >
                <Text style={styles.noteEditText}>Edit note</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {items.length > 0 ? (
        <View style={styles.card}>
          {items.map((item, i) => (
            <View key={`${item.name}-${i}`} style={styles.cardRow}>
              <View style={styles.cardRowText}>
                <Text style={styles.cardDishName}>{item.name}</Text>
                <Text style={styles.cardDishMeta}>
                  {formatPHP(item.price) ?? '—'} x {item.quantity}
                </Text>
              </View>
              <Text style={styles.cardLineTotal}>{formatPHP(item.lineTotal) ?? '—'}</Text>
            </View>
          ))}
          <Text style={styles.cardTotal}>
            Selected Items ({mealCardDishCount(items)}) · Total: {formatPHP(mealCardTotal(items)) ?? '₱0'}
          </Text>
          <Text style={styles.cardValid}>Valid until {mealCardValidUntil()}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { paddingHorizontal: 24, paddingVertical: 24, gap: 8 },
  center: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  muted: { fontSize: 13, color: '#6b7280' },
  errorText: { fontSize: 14, color: '#dc2626', textAlign: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', color: BLUE },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', lineHeight: 30 },
  meta: { fontSize: 13, color: '#6b7280' },
  mapBtn: { marginTop: 4, borderRadius: 12, backgroundColor: '#ffffff', padding: 12 },
  mapRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mapText: { flex: 1, fontSize: 13, color: '#374151' },
  goodFor: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  noteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    gap: 6,
    marginTop: 8,
  },
  noteForm: { gap: 6 },
  noteLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#6b7280',
    marginTop: 4,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  noteInputMultiline: { minHeight: 96, textAlignVertical: 'auto' },
  noteBody: { fontSize: 15, color: '#111827', lineHeight: 21 },
  noteEmpty: { fontSize: 13, color: '#6b7280' },
  noteError: { fontSize: 13, color: '#dc2626' },
  noteActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  noteSaveBtn: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: BLUE,
    paddingVertical: 13,
    alignItems: 'center',
  },
  noteSaveText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  noteCancelBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 13,
    alignItems: 'center',
  },
  noteCancelText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  noteBtnDisabled: { opacity: 0.6 },
  noteEditBtn: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingVertical: 11,
    alignItems: 'center',
  },
  noteEditText: { color: BLUE, fontSize: 15, fontWeight: '600' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    gap: 8,
    marginTop: 8,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardRowText: { flex: 1, gap: 2 },
  cardDishName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardDishMeta: { fontSize: 13, color: '#6b7280', fontVariant: ['tabular-nums'] },
  cardLineTotal: { fontSize: 16, fontWeight: '700', color: BLUE, fontVariant: ['tabular-nums'] },
  cardTotal: { fontSize: 14, fontWeight: '700', color: '#111827', fontVariant: ['tabular-nums'], marginTop: 4 },
  cardValid: { fontSize: 13, color: '#6b7280' },
});
