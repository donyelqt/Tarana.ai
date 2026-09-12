import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { EyeIcon, EyeSlashIcon, GoogleIcon } from './icons';
import { config } from '../config';
import { importWebTrips } from '../data';

const API_BASE = config.webBaseUrl.replace(/\/$/, '');

const BLUE = '#0066FF';
const BLUE_LIGHT = '#1E90FF';

export default function LinkAccount({ navigation, onDone }: { navigation: any; onDone?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  /**
   * One-way import (§7.4): the typed email/password only gate the button —
   * actual auth happens in the web-browser exchange inside the data seam
   * (same as the old sign-in flow). The JWT is single-use: trips are
   * copied into SQLite, then the app forgets the web session entirely.
   */
  const runImport = async () => {
    await importWebTrips(email);
  };

  const finish = () => {
    if (onDone) onDone();
    else navigation.navigate('Home');
  };

  const handleSubmit = async () => {
    setError(null);
    if (!email || !password) { setError('Email and password are required'); return; }
    setLoading(true);
    try {
      await runImport();
      finish();
    } catch (e: any) {
      setError(e?.message || 'Link did not complete');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    // Web OAuth IS the link path: the same web-browser exchange flow backs
    // both the CTA and the Google button. No native Google SDK.
    setError(null);
    setLoading(true);
    try {
      await runImport();
      finish();
    } catch (e: any) {
      setError(e?.message || 'Link did not complete');
    } finally {
      setLoading(false);
    }
  };

  const openForgotPassword = () => {
    void WebBrowser.openBrowserAsync(`${API_BASE}/auth/forgot-password`);
  };

  return (
    <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.form}>
        <Text style={styles.importNote}>Your web trips are copied onto this device. No account is kept here.</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
            accessibilityLabel="Email"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.pwWrap}>
            <TextInput
              ref={passwordRef}
              style={[styles.input, { paddingRight: 40 }]}
              placeholder="Enter your Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              returnKeyType="done"
              onSubmitEditing={() => { if (!loading) void handleSubmit(); }}
              accessibilityLabel="Password"
            />
            <TouchableOpacity
              style={styles.eyeOverlay}
              onPress={() => setShowPassword((p) => !p)}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeSlashIcon size={20} /> : <EyeIcon size={20} />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.rowEnd}>
          <TouchableOpacity accessibilityRole="button" onPress={openForgotPassword}>
            <Text style={styles.forgot}>Forgot Password ?</Text>
          </TouchableOpacity>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Link web account"
          style={styles.ctaOuter}
        >
          <LinearGradient
            colors={[BLUE, BLUE_LIGHT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{loading ? 'Linking...' : 'Link web account'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.google}
          onPress={handleGoogle}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          <GoogleIcon size={16} />
          <Text style={styles.googleText}>Google</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: '#ffffff' },
  root: { flex: 1, backgroundColor: '#ffffff' },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-start', paddingHorizontal: 40, paddingVertical: 24 },
  form: { width: '100%', maxWidth: 448, alignSelf: 'center' },
  importNote: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  pwWrap: { position: 'relative', justifyContent: 'center' },
  eyeOverlay: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center', padding: 4 },
  rowEnd: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, color: '#111827' },
  eye: { padding: 4 },
  forgot: { fontSize: 12, color: '#9ca3af' },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { color: '#dc2626', fontSize: 13 },
  ctaOuter: { borderRadius: 16, marginTop: 4 },
  cta: { paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#d1d5db' },
  dividerText: { marginHorizontal: 12, fontSize: 12, color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  google: { borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#ffffff', paddingVertical: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  googleText: { color: '#111827', fontSize: 16, fontWeight: '500' },
});
