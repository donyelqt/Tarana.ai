import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { createProfile } from '../db';

const BLUE = '#0066FF';
const BLUE_LIGHT = '#1E90FF';

export default function ProfileCreate({ onDone }: { navigation: any; onDone?: () => void }) {
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!fullName.trim()) { setError('Please enter a display name'); return; }
    setLoading(true);
    try {
      await createProfile(fullName);
      if (onDone) onDone();
    } catch (e: any) {
      setError(e?.message || 'Could not create profile. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.root} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput style={styles.input} placeholder="What should we call you?" value={fullName} onChangeText={setFullName} autoCapitalize="words"
            autoComplete="name"
            returnKeyType="done"
            onSubmitEditing={() => { if (!loading) void handleSubmit(); }}
            accessibilityLabel="Display Name" />
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Start Planning"
          style={styles.ctaOuter}
        >
          <LinearGradient
            colors={[BLUE, BLUE_LIGHT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{loading ? 'Creating Profile...' : 'Start Planning'}</Text>
          </LinearGradient>
        </TouchableOpacity>

      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: '#ffffff' },
  root: { flex: 1, backgroundColor: '#ffffff' },
  container: { flexGrow: 1, justifyContent: 'flex-start', paddingHorizontal: 40, paddingVertical: 24 },
  form: { width: '100%', maxWidth: 448, alignSelf: 'center' },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, color: '#111827' },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { color: '#dc2626', fontSize: 13 },
  ctaOuter: { borderRadius: 16, marginTop: 4 },
  cta: { paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
});
