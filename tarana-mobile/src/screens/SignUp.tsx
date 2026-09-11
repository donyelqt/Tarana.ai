import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { EyeIcon, EyeSlashIcon, CheckIcon, BulletIcon } from './icons';
import { validatePasswordStrength } from 'tarana-web/security/inputSanitizer';
import { config } from '../config';

const API_BASE = config.webBaseUrl.replace(/\/$/, '');

const BLUE = '#0066FF';
const BLUE_LIGHT = '#1E90FF';

const getStrengthColor = (s: string) => ({ 'very-weak': '#ff0000', weak: '#ff6600', medium: '#ffcc00', strong: '#66cc00', 'very-strong': '#00cc00' }[s] || '#ff0000');
const getStrengthLabel = (s: string) => ({ 'very-weak': 'Very Weak', weak: 'Weak', medium: 'Medium', strong: 'Strong', 'very-strong': 'Very Strong' }[s] || '');

export default function SignUp({ navigation, onSignedIn }: { navigation: any; onSignedIn?: () => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCPw, setShowCPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ps = password ? validatePasswordStrength(password) : null;

  const openTerms = () => {
    void WebBrowser.openBrowserAsync(`${API_BASE}/terms`);
  };

  const openPrivacy = () => {
    void WebBrowser.openBrowserAsync(`${API_BASE}/privacy`);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!agreed) { setError('Please accept the Terms of Service and Privacy Policy'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (ps && !ps.isValid) { setError(ps.errors[0] || 'Password does not meet security requirements'); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, agreed: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Registration failed');
      if (onSignedIn) onSignedIn();
      else navigation.navigate('AuthEntry');
    } catch (e: any) {
      setError(e?.message || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} placeholder="Enter your Full Name" value={fullName} onChangeText={setFullName} autoCapitalize="words"
            autoComplete="name"
            accessibilityLabel="Full Name" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} placeholder="Enter your Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" accessibilityLabel="Email" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} placeholder="Enter your Password" value={password} onChangeText={setPassword} secureTextEntry={!showPw} autoComplete="new-password" accessibilityLabel="Password" />
            <TouchableOpacity style={styles.eye} onPress={() => setShowPw((p) => !p)} accessibilityLabel={showPw ? 'Hide password' : 'Show password'}>{showPw ? <EyeSlashIcon size={20} /> : <EyeIcon size={20} />}</TouchableOpacity>
          </View>
          {ps ? (
            <View style={styles.meter}>
              <View style={styles.meterLabels}><Text style={styles.meterLabel}>Strength: {getStrengthLabel(ps.strengthLevel)}</Text><Text style={styles.meterLabel}>{ps.score}/10</Text></View>
              <View style={styles.meterTrack}><View style={[styles.meterFill, { width: `${Math.min(100, ps.score * 10)}%`, backgroundColor: getStrengthColor(ps.strengthLevel) }]} /></View>
              {ps.feedback && ps.feedback.length > 0 && (<View style={styles.feedback}>{ps.feedback.map((m, i) => (<View key={i} style={styles.feedbackRow}><BulletIcon size={12} /><Text style={styles.feedbackText}>{m}</Text></View>))}</View>)}
              {ps.isValid && (<View style={styles.success}><CheckIcon size={14} /><Text style={styles.successText}>Strong password</Text></View>)}
            </View>
          ) : null}
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} placeholder="Re-enter your Password" value={confirm} onChangeText={setConfirm} secureTextEntry={!showCPw} autoComplete="new-password" accessibilityLabel="Confirm Password" />
            <TouchableOpacity style={styles.eye} onPress={() => setShowCPw((p) => !p)} accessibilityLabel={showCPw ? 'Hide password' : 'Show password'}>{showCPw ? <EyeSlashIcon size={20} /> : <EyeIcon size={20} />}</TouchableOpacity>
          </View>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        <View style={styles.tosRow}>
          <TouchableOpacity onPress={() => setAgreed((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} style={styles.tosCheck}>
            <View style={[styles.checkbox, agreed && styles.checkboxOn]} />
          </TouchableOpacity>
          <Text style={styles.tosText}>I agree to the <Text style={styles.link} onPress={openTerms}>Terms of Service</Text> and <Text style={styles.link} onPress={openPrivacy}>Privacy Policy</Text></Text>
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Create Account"
          style={styles.ctaOuter}
        >
          <LinearGradient
            colors={[BLUE, BLUE_LIGHT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{loading ? 'Creating Account...' : 'Create Account'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.linkRow}>
          <Text style={styles.linkText}>Already have an account? </Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('AuthEntry', { mode: 'signin' })}>
            <Text style={styles.linkTextBold}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  container: { padding: 24, paddingTop: 24 },
  form: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#ffffff', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, color: '#111827' },
  eye: { padding: 4 },
  checkbox: { width: 16, height: 16, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, backgroundColor: '#ffffff' },
  checkboxOn: { backgroundColor: BLUE, borderColor: BLUE },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { color: '#dc2626', fontSize: 13 },
  meter: { marginTop: 8 },
  meterLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  meterLabel: { fontSize: 11, color: '#6b7280' },
  meterTrack: { width: '100%', backgroundColor: '#e5e7eb', borderRadius: 999, height: 6, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 999 },
  feedback: { marginTop: 6 },
  feedbackRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 },
  feedbackText: { fontSize: 13, color: '#6b7280', marginLeft: 4 },
  success: { marginTop: 6, flexDirection: 'row', alignItems: 'flex-start' },
  successText: { color: '#00a800', fontSize: 13, marginLeft: 4 },
  tosRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4, marginBottom: 12 },
  tosCheck: { marginRight: 8, marginTop: 2 },
  tosText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  link: { color: BLUE, fontWeight: '500' },
  ctaOuter: { borderRadius: 24, marginTop: 4 },
  cta: { paddingVertical: 14, borderRadius: 24, alignItems: 'center' },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  linkText: { fontSize: 13, color: '#6b7280' },
  linkTextBold: { fontSize: 13, color: BLUE, fontWeight: '500' },
});
