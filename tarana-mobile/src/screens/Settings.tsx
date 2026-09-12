import { useCallback, useEffect, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { config } from '../config';
import { getActiveProfile, signOut, type LocalProfile } from '../data';

const API_BASE = config.webBaseUrl.replace(/\/$/, '');

type SettingsNav = {
  replace: (route: string) => void;
  navigate: (route: string, params?: Record<string, unknown>) => void;
};

/**
 * Settings — minimal local-first surface (§7.4 breakdown).
 * About (Terms/Privacy, moved out of the creation flow), one-way web
 * import entry, and sign-out (clears the active local profile).
 */
export default function Settings({ navigation }: { navigation: SettingsNav }) {
  const [profile, setProfile] = useState<LocalProfile | null>(null);

  const load = useCallback(async () => {
    setProfile(await getActiveProfile());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openTerms = () => {
    void WebBrowser.openBrowserAsync(`${API_BASE}/terms`);
  };

  const openPrivacy = () => {
    void WebBrowser.openBrowserAsync(`${API_BASE}/privacy`);
  };

  const onSignOut = async () => {
    await signOut();
    navigation.replace('Landing');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F7' }} className="px-6 pt-4">
      <Text className="mb-1 text-2xl font-semibold text-foreground">
        {profile ? `Hi, ${profile.display_name}` : 'Settings'}
      </Text>
      <Text className="mb-6 text-sm text-muted-foreground">Everything stays on this device.</Text>
      <View className="mb-3 w-full rounded-lg bg-primary px-4 py-1">
        <Button
          title="Link web account"
          onPress={() => navigation.navigate('AuthEntry', { mode: 'import' })}
          color="#ffffff"
        />
      </View>
      <View className="mb-3 w-full flex-row justify-center gap-4 rounded-lg bg-card px-4 py-3">
        <Text className="text-sm text-primary" onPress={openTerms}>Terms of Service</Text>
        <Text className="text-sm text-muted-foreground">·</Text>
        <Text className="text-sm text-primary" onPress={openPrivacy}>Privacy Policy</Text>
      </View>
      <View className="rounded-lg bg-card px-4 py-1">
        <Button title="Sign out" onPress={onSignOut} color="#0f172a" />
      </View>
      <StatusBar style="auto" />
    </View>
  );
}
