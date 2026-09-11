import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Home from './src/screens/Home';
import SavedTrips from './src/screens/SavedTrips';
import Spots from './src/screens/Spots';
import Landing from './src/screens/Landing';
import AuthEntry from './src/screens/AuthEntry';
import Settings from './src/screens/Settings';

export type RootStackParamList = {
  Home: undefined;
  SavedTrips: undefined;
  Spots: undefined;
  Landing: undefined;
  AuthEntry: { mode?: 'fresh' | 'import' } | undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * App — navigation shell only. Screens own their logic;
 * no business logic lives here.
 *
 * Local-first (§2.1, §7.4): `Landing` is the initial route. First run
 * goes Landing → AuthEntry (fresh → ProfileCreate, import → LinkAccount)
 * → Home. `AuthGate` is gone (tagged at mobile-auth-ui-v1 for rollback);
 * its post-exchange role moved into LinkAccount's one-way import.
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
        <Stack.Screen name="Home" component={Home} options={{ title: 'Tarana' }} />
        <Stack.Screen name="SavedTrips" component={SavedTrips} options={{ title: 'Saved trips' }} />
        <Stack.Screen name="Spots" component={Spots} options={{ title: 'Spots' }} />
        <Stack.Screen name="Settings" component={Settings} options={{ title: 'Settings' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}