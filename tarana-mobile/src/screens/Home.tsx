import { Button, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { clearStoredToken } from '../auth';

type HomeNav = {
  replace: (route: string) => void;
  navigate: (route: string) => void;
};

/**
 * Home — hub proving the stack works.
 * Real content lives in SavedTrips and Spots (Slice B).
 */
export default function Home({ navigation }: { navigation: HomeNav }) {
  const onSignOut = async () => {
    await clearStoredToken();
    navigation.replace('AuthGate');
  };

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="mb-2 text-2xl font-semibold text-foreground">Tarana mobile</Text>
      <Text className="mb-6 text-sm text-muted-foreground">You are signed in.</Text>
      <View className="mb-3 w-full rounded-lg bg-primary px-4 py-1">
        <Button title="Saved trips" onPress={() => navigation.navigate('SavedTrips')} color="#ffffff" />
      </View>
      <View className="mb-6 w-full rounded-lg bg-primary px-4 py-1">
        <Button title="Suggested spots" onPress={() => navigation.navigate('Spots')} color="#ffffff" />
      </View>
      <View className="rounded-lg bg-secondary px-4 py-1">
        <Button title="Sign out" onPress={onSignOut} color="#0f172a" />
      </View>
      <StatusBar style="auto" />
    </View>
  );
}
