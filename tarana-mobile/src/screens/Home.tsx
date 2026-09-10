import { Button, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { clearStoredToken } from '../auth';

/**
 * Home — placeholder screen proving the stack works.
 * Real content (saved trips, spots) lands in Slice B.
 */
export default function Home({ navigation }: { navigation: { replace: (route: string) => void } }) {
  const onSignOut = async () => {
    await clearStoredToken();
    navigation.replace('AuthGate');
  };

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="mb-2 text-2xl font-semibold text-foreground">Tarana mobile</Text>
      <Text className="mb-1 text-sm text-muted-foreground">You are signed in.</Text>
      <Text className="mb-6 text-sm text-muted-foreground">Saved trips and spots arrive in the next slice.</Text>
      <View className="rounded-lg bg-primary px-4 py-2">
        <Button title="Sign out" onPress={onSignOut} color="#ffffff" />
      </View>
      <StatusBar style="auto" />
    </View>
  );
}
