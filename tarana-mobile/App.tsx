import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthGate from './src/screens/AuthGate';
import Home from './src/screens/Home';

export type RootStackParamList = {
  AuthGate: undefined;
  Home: undefined;
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
