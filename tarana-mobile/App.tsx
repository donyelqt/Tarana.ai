import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { loadAuthState, exchangeForMobileToken, clearStoredToken } from './src/auth';
import { config } from './src/config';

export default function App() {
  const [state, setState] = useState<{ token: string | null; loading: boolean; error?: string }>({
    token: null,
    loading: true,
  });

  useEffect(() => {
    loadAuthState().then((s) => setState({ token: s.token, loading: false }));
  }, []);

  const onExchange = async () => {
    try {
      await exchangeForMobileToken();
      const s = await loadAuthState();
      setState({ token: s.token, loading: false });
    } catch (e) {
      setState({ token: null, loading: false, error: e instanceof Error ? e.message : 'Sign-in failed' });
    }
  };

  const onClear = async () => {
    await clearStoredToken();
    setState({ token: null, loading: false });
  };

  if (state.loading) {
    return (
      <View style={styles.container}>
        <Text>Loading…</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tarana mobile</Text>
      <Text style={styles.sub}>Web base: {config.webBaseUrl}</Text>
      {state.token ? (
        <>
          <Text style={styles.ok}>Signed in</Text>
          <Button title="Sign out" onPress={onClear} />
        </>
      ) : (
        <>
          {state.error ? <Text style={styles.err}>{state.error}</Text> : null}
          <Button title="Sign in with web account" onPress={onExchange} />
        </>
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 8 },
  sub: { fontSize: 12, color: '#666', marginBottom: 24 },
  ok: { color: '#1a7f37', marginBottom: 16 },
  err: { color: '#c00', marginBottom: 16 },
});