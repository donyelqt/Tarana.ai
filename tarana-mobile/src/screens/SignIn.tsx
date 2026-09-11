import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { EyeIcon, EyeSlashIcon, GoogleIcon } from './icons';
import { exchangeForMobileToken } from '../auth';
import { config } from '../config';

const API_BASE = config.webBaseUrl.replace(/\/$/, '');

const BLUE = '#0066FF';
const BLUE_LIGHT = '#1E90FF';

export default function SignIn({ navigation, onSignedIn }: { navigation: any; onSignedIn?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const completeExchange = async () => {
    await exchangeForMobileToken();
    if (onSignedIn) onSignedIn();
    else navigation.navigate('Home');
  };

  const handleSubmit = async () => {
    setError(null);
    if (!email || !password) { setError('Email and password are required'); return; }
    setLoading(true);
    try {
      await completeExchange();
    } catch (e: any) {
      setError(e?.message || 'Sign in did not complete');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    // Web OAuth IS the mobile Google path: the same web-browser exchange
    // flow backs both the Login CTA and the Google button. No separate
    // native Google SDK — the web app is the single source of truth.
    setError(null);
    setLoading(true);
    try {
      await completeExchange();
    } catch (e: any) {
      setError(e?.message || 'Sign in did not complete');
    } finally {
      setLoading(false);
    }
  };

  const openForgotPassword = () => {
    void WebBrowser.openBrowserAsync(`${API_BASE}/auth/forgot-password`);
  };

  const openTerms = () => {
    void WebBrowser.openBrowserAsync(`${API_BASE}/terms`);
  };

  const openPrivacy = () => {
    void WebBrowser.openBrowserAsync(`${API_BASE}/privacy`);
  };

  return (
    <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.form}>
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
          <View style={styles.row}>
            <TextInput
              ref={passwordRef}
              style={[styles.input, { flex: 1, marginRight: 8 }]}
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
              style={styles.eye}
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
          accessibilityLabel="Login"
          style={styles.ctaOuter}
        >
          <LinearGradient
            colors={[BLUE, BLUE_LIGHT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{loading ? 'Signing in...' : 'Login'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.terms}>
          By signing in, you agree to our{'\n'}
          <Text style={styles.link} onPress={openTerms}>Terms of Service</Text> and{' '}
          <Text style={styles.link} onPress={openPrivacy}>Privacy Policy</Text>.
        </Text>

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
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 24 },
  form: { width: '100%', maxWidth: 448, alignSelf: 'center' },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowEnd: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, color: '#111827' },
  eye: { padding: 4 },
  forgot: { fontSize: 12, color: '#9ca3af' },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { color: '#dc2626', fontSize: 13 },
  ctaOuter: { borderRadius: 16, marginTop: 4 },
  cta: { paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
  terms: { fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 16, lineHeight: 16 },
  link: { color: BLUE, fontWeight: '500' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#d1d5db' },
  dividerText: { marginHorizontal: 12, fontSize: 12, color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  google: { borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#ffffff', paddingVertical: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  googleText: { color: '#111827', fontSize: 16, fontWeight: '500' },
});
