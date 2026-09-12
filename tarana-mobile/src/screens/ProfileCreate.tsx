import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { GradientCTA } from './ui';
import { createProfile } from '../data';

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
            placeholderTextColor="#9ca3af"
            accessibilityLabel="Display Name" />
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        <GradientCTA
          variant="auth"
          title="Start Planning"
          loadingTitle="Creating Profile..."
          loading={loading}
          onPress={handleSubmit}
          accessibilityLabel="Start Planning"
        />

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
});
