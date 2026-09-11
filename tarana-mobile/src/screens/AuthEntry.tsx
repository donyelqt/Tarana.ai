/**
 * Auth entry — the shared shell for first-run fresh start / web import.
 *
 * Keeps the Phase 3b segmented pill shell (and its exact styling) with
 * rebound semantics (§2.1, §7.4): the toggle no longer selects an auth
 * method. `fresh` creates a local SQLite profile (offline); `import`
 * links a web account once and copies trips on-device (online).
 *
 * Owns no identity logic. It only selects which screen to render.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeIcon } from './icons';
import { DotsGrid, Sparkles } from './decor';
import ProfileCreateScreen from './ProfileCreate';
import LinkAccountScreen from './LinkAccount';

const BRAND_BLUE = '#0066FF';

type Mode = 'fresh' | 'import';

type AuthEntryRoute = {
  params?: { mode?: Mode };
};

export default function AuthEntry({
  navigation,
  route,
}: {
  navigation: any;
  route?: AuthEntryRoute;
}) {
  // Read the initial `mode` param ONCE — the toggle owns it afterwards.
  // Landing lands here with no param (defaults `fresh`); Settings links
  // here with `{ mode: 'import' }`.
  const [mode, setMode] = useState<Mode>(route?.params?.mode ?? 'fresh');
  // Safe-area top inset keeps the absolute Home button below the camera/notch
  // and the time/battery row, so it never overlaps the system chrome.
  const insets = useSafeAreaInsets();

  // After profile creation or a completed import, drop into Home.
  // Reset the toggle to `fresh` so a return visit never strands the user
  // on the import screen.
  const onDone = () => {
    setMode('fresh');
    navigation.navigate('Home');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <DotsGrid />
      <Sparkles />
      {/* Mobile Back to Home — mirrors the web signin page's md:hidden Home button
          (`src/app/auth/signin/page.tsx:157-163`), which is the mobile-view
          affordance the web app ships. Pinned to the safe-area top so it sits
          below the camera/notch and the time/battery row. */}
      <TouchableOpacity
        style={[styles.homeBtn, { top: insets.top + 16 }]}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Back to home"
        onPress={() => navigation.navigate('Landing')}
      >
        <HomeIcon size={16} color="#ffffff" />
        <Text style={styles.homeBtnText}>Home</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.brandAccentBar} />
        <Text style={styles.title}>
          Welcome{mode === 'import' ? ' back' : ''} <Text style={styles.titleAccent}>to Tarana.ai</Text>
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'import' ? 'Bring your web trips here' : 'Start planning on this device'}
        </Text>
      </View>

      {/* Segmented fresh/import toggle — same pill shell, rebound semantics. */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.pill, mode === 'fresh' && styles.pillActive]}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'fresh' }}
          onPress={() => setMode('fresh')}
        >
          <Text style={[styles.pillText, mode === 'fresh' && styles.pillTextActive]}>Start fresh</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pill, mode === 'import' && styles.pillActive]}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'import' }}
          onPress={() => setMode('import')}
        >
          <Text style={[styles.pillText, mode === 'import' && styles.pillTextActive]}>Import</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formShell}>
        {mode === 'fresh' ? (
          <ProfileCreateScreen navigation={navigation} onDone={onDone} />
        ) : (
          <LinkAccountScreen navigation={navigation} onDone={onDone} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff', paddingHorizontal: 40, paddingTop: 0, paddingBottom: 24, justifyContent: 'flex-start' },
  homeBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BRAND_BLUE,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  homeBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '500' },
  header: { alignItems: 'center', marginTop: 56, marginBottom: 32 },
  brandAccentBar: { width: 32, height: 4, backgroundColor: BRAND_BLUE, borderRadius: 4, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '600', color: '#111827', textAlign: 'center', lineHeight: 34 },
  titleAccent: { color: BRAND_BLUE },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 6, textAlign: 'center' },

  toggleRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  pillActive: { backgroundColor: BRAND_BLUE, borderColor: BRAND_BLUE },
  pillText: { color: BRAND_BLUE, fontSize: 14, fontWeight: '500' },
  pillTextActive: { color: '#ffffff' },

  formShell: { flex: 1, width: '100%', maxWidth: 448, alignSelf: 'center', justifyContent: 'center' },
});
