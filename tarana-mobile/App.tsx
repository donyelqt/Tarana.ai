import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthGate from './src/screens/AuthGate';
import Home from './src/screens/Home';
import SavedTrips from './src/screens/SavedTrips';
import Spots from './src/screens/Spots';
import Landing from './src/screens/Landing';
import AuthEntry from './src/screens/AuthEntry';

export type RootStackParamList = {
  AuthGate: undefined;
  Home: undefined;
  SavedTrips: undefined;
  Spots: undefined;
  Landing: undefined;
  AuthEntry: { mode?: 'signin' | 'signup' } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * App — navigation shell only. Screens own their logic;
 * no business logic lives here.
 *
 * Phase 3b (2026-09-10): `Landing` is now the initial route. The app used to
 * boot straight into `AuthGate`, so users were dropped into a sign-in flow
 * with no marketing/entry surface and no way to create an account. `AuthGate`
 * remains the post-exchange target (unchanged) — it is what runs after the
 * mobile token bridge completes.
 */
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Landing">
        <Stack.Screen
          name="Landing"
          component={Landing}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AuthEntry"
          component={AuthEntry}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="AuthGate" component={AuthGate} options={{ title: 'Sign in' }} />
        <Stack.Screen name="Home" component={Home} options={{ title: 'Tarana' }} />
        <Stack.Screen name="SavedTrips" component={SavedTrips} options={{ title: 'Saved trips' }} />
        <Stack.Screen name="Spots" component={Spots} options={{ title: 'Spots' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}