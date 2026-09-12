import { Button, Pressable, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Home from './src/screens/Home';
import SavedTrips from './src/screens/SavedTrips';
import TripDetail from './src/screens/TripDetail';
import SavedCafes from './src/screens/SavedCafes';
import CafeDetail from './src/screens/CafeDetail';
import Eats from './src/screens/Eats';
import Plan from './src/screens/Plan';
import Explore from './src/screens/Explore';
import Spots from './src/screens/Spots';
import Landing from './src/screens/Landing';
import AuthEntry from './src/screens/AuthEntry';
import ActionSheet from './src/screens/ActionSheet';
import Settings from './src/screens/Settings';
import { HomeIcon, MapPinIcon, CompassIcon, GearIcon, PlusIcon } from './src/screens/icons';

const BLUE = '#0066FF';
const BLUE_LIGHT = '#1E90FF';
const INACTIVE = '#9ca3af';

export type TabParamList = {
  Home: undefined;
  SavedTrips: undefined;
  Action: undefined;
  Spots: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Landing: undefined;
  AuthEntry: { mode?: 'fresh' | 'import' } | undefined;
  MainTabs: undefined;
  TripDetail: { id: string };
  SavedCafes: undefined;
  CafeDetail: { name: string };
  Eats: undefined;
  Plan: undefined;
  Explore: undefined;
  ActionSheet: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

/**
 * Center action disc — pure visual inside a Pressable that forwards the
 * tab press. The `tabPress` listener below intercepts it (preventDefault +
 * open sheet). Dropping `onPress` here means the event never fires and the
 * sheet never opens — that was the bug.
 */
function ActionDisc() {
  return (
    <View
      accessibilityRole="button"
      accessibilityLabel="Create"
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: BLUE,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -20,
        shadowColor: '#0f172a',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      }}
    >
      <PlusIcon size={28} color="#ffffff" />
    </View>
  );
}

function NullScreen() {
  return null;
}

/**
 * MainTabs — sticky bottom tab bar (§9 + Appllama navigation law 5).
 *
 * Five peers: Home, Trips, center Action, Spots, Settings. One icon
 * family, single accent, native headers owned by the navigator.
 * Flows (Plan, Explore, Eats) and details live in the root stack ABOVE
 * the tabs: push from anywhere, back returns. Landing/AuthEntry stay
 * chromeless; auth seals with replace one-way doors.
 */
function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        tabBarActiveTintColor: BLUE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerTitleStyle: { fontSize: 17, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={Home}
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <HomeIcon size={size} color={color} strokeWidth={2} />,
          tabBarAccessibilityLabel: 'Home tab',
        }}
      />
      <Tab.Screen
        name="SavedTrips"
        component={SavedTrips}
        options={{
          title: 'Saved trips',
          tabBarLabel: 'Trips',
          tabBarIcon: ({ color, size }) => <MapPinIcon size={size} color={color} />,
          tabBarAccessibilityLabel: 'Trips tab',
        }}
      />
      <Tab.Screen
        name="Action"
        component={NullScreen}
        options={{
          tabBarLabel: '',
          tabBarButton: ({ onPress, accessibilityLabel }) => (
            <Pressable
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel ?? 'Create'}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <ActionDisc />
            </Pressable>
          ),
          tabBarAccessibilityLabel: 'Create tab',
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.getParent()?.navigate('ActionSheet');
          },
        })}
      />
      <Tab.Screen
        name="Spots"
        component={Spots}
        options={{
          title: 'Spots',
          tabBarLabel: 'Spots',
          tabBarIcon: ({ color, size }) => <CompassIcon size={size} color={color} />,
          tabBarAccessibilityLabel: 'Spots tab',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={Settings}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <GearIcon size={size} color={color} />,
          tabBarAccessibilityLabel: 'Settings tab',
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * App — navigation shell only. Screens own their logic;
 * no business logic lives here.
 *
 * Local-first (§2.1, §7.4): `Landing` is the initial route. First run
 * goes Landing → AuthEntry (fresh → ProfileCreate, import → LinkAccount)
 * → MainTabs (one-way door: replace, back can never re-enter auth).
 * `AuthGate` is gone (tagged at mobile-auth-ui-v1 for rollback);
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
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="TripDetail" component={TripDetail} options={{ title: 'Trip' }} />
        <Stack.Screen name="SavedCafes" component={SavedCafes} options={{ title: 'Saved cafes' }} />
        <Stack.Screen name="CafeDetail" component={CafeDetail} options={{ title: 'Cafe' }} />
        <Stack.Screen
          name="Eats"
          component={Eats}
          options={({ navigation }) => ({
            title: 'Eats',
            headerRight: () => (
              <Button title="Saved" color={BLUE} onPress={() => navigation.navigate('SavedCafes')} />
            ),
          })}
        />
        <Stack.Screen name="Plan" component={Plan} options={{ title: 'Plan a trip' }} />
        <Stack.Screen name="Explore" component={Explore} options={{ title: 'Explore' }} />
        <Stack.Screen
          name="ActionSheet"
          component={ActionSheet}
          options={{ headerShown: false, presentation: 'transparentModal', animation: 'fade' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
