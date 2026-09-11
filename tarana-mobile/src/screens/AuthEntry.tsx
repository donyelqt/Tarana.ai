/**
 * Auth entry — the shared shell for sign-in / sign-up.
 *
 * Mirrors the WEB signin page's segmented Login/Register toggle exactly
 * (`src/app/auth/signin/page.tsx:172-187`):
 *   - active pill:  bg-[#0066FF] text-white
 *   - inactive pill: bg-blue-50 text-[#0066FF]
 *
 * Owns no auth logic. It only selects which screen to render; the screens
 * themselves do the work (mobile sign-in = the existing exchangeForMobileToken
 * web-browser flow; mobile sign-up = native form posting to /api/auth/register).
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { HomeIcon } from './icons';
import { DotsGrid, Sparkles } from './decor';
import SignInScreen from './SignIn';
import SignUpScreen from './SignUp';

const BRAND_BLUE = '#0066FF';

type Mode = 'signin' | 'signup';

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
  // Deep-links (e.g. SignUp's "Already have an account? Sign in") land here
  // with `{ mode: 'signin' }`; default stays `signin` when absent.
  const [mode, setMode] = useState<Mode>(route?.params?.mode ?? 'signin');

  // After a successful sign-in or sign-up, drop into the signed-in state:
  // switch the toggle to Login (so the user is not stuck on a Register
  // screen that has just created their account) and open Home.
  const onSignedIn = () => {
    setMode('signin');
    navigation.navigate('Home');
  };

  return (
    <View style={styles.root}>
      <DotsGrid />
      <Sparkles />
      {/* Mobile Back to Home — mirrors the web signin page's md:hidden Home button
          (`src/app/auth/signin/page.tsx:157-163`), which is the mobile-view
          affordance the web app ships. */}
      <TouchableOpacity
        style={styles.homeBtn}
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
          Welcome{mode === 'signup' ? '' : ' back'} <Text style={styles.titleAccent}>to Tarana.ai</Text>
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'signup' ? 'Create your account' : 'Sign in to your account'}
        </Text>
      </View>

      {/* Segmented Login/Register toggle — mirrors the web pill switch. */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.pill, mode === 'signin' && styles.pillActive]}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'signin' }}
          onPress={() => setMode('signin')}
        >
          <Text style={[styles.pillText, mode === 'signin' && styles.pillTextActive]}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pill, mode === 'signup' && styles.pillActive]}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'signup' }}
          onPress={() => setMode('signup')}
        >
          <Text style={[styles.pillText, mode === 'signup' && styles.pillTextActive]}>Register</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.formShell}>
        {mode === 'signin' ? (
          <SignInScreen navigation={navigation} onSignedIn={onSignedIn} />
        ) : (
          <SignUpScreen navigation={navigation} onSignedIn={onSignedIn} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff', paddingHorizontal: 40, paddingVertical: 24, justifyContent: 'center' },
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
  header: { alignItems: 'center', marginBottom: 28 },
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

  formShell: { flex: 1, width: '100%', maxWidth: 448, alignSelf: 'center' },
});
