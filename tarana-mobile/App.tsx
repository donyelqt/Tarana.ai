import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthGate from './src/screens/AuthGate';
import Home from './src/screens/Home';
import SavedTrips from './src/screens/SavedTrips';
import Spots from './src/screens/Spots';

export type RootStackParamList = {
  AuthGate: undefined;
  Home: undefined;
  SavedTrips: undefined;
  Spots: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * App — navigation shell only. Screens own their logic;
 * no business logic lives here.
 */
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="AuthGate">
        <Stack.Screen name="AuthGate" component={AuthGate} options={{ title: 'Sign in' }} />
        <Stack.Screen name="Home" component={Home} options={{ title: 'Tarana' }} />
        <Stack.Screen name="SavedTrips" component={SavedTrips} options={{ title: 'Saved trips' }} />
        <Stack.Screen name="Spots" component={Spots} options={{ title: 'Spots' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
