import { Button, Pressable, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import Home from './src/screens/Home';
import SavedTrips from './src/screens/SavedTrips';
import TripDetail from './src/screens/TripDetail';
import SavedCafes from './src/screens/SavedCafes';
import CafeDetail from './src/screens/CafeDetail';
import SavedMealDetail from './src/screens/SavedMealScreen';
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
  SavedMealDetail: { id: string };
  Eats: undefined;
  Plan: undefined;
  Explore: undefined;
  ActionSheet: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

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

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        tabBarActiveTintColor: BLUE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerTitleStyle: { fontSize: 17, fontWeight: '600' },
        tabBarButton: (props) => (
          <PlatformPressable {...props} pressColor="rgba(0,102,255,0.16)" />
        ),
      }}
    >
      <Tab.Screen
        name="Home"
        component={Home}
        options={{
          headerShown: false,
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <HomeIcon size={size} color={color} strokeWidth={2} />,
          tabBarAccessibilityLabel: 'Home tab',
        }}
      />
      <Tab.Screen
        name="SavedTrips"
        component={SavedTrips}
        options={{
          headerShown: false,
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
          headerShown: false,
          tabBarLabel: 'Spots',
          tabBarIcon: ({ color, size }) => <CompassIcon size={size} color={color} />,
          tabBarAccessibilityLabel: 'Spots tab',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={Settings}
        options={{
          headerShown: false,
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <GearIcon size={size} color={color} />,
          tabBarAccessibilityLabel: 'Settings tab',
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
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
        <Stack.Screen
          name="SavedCafes"
          component={SavedCafes}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen name="CafeDetail" component={CafeDetail} options={{ title: 'Cafe' }} />
        <Stack.Screen name="SavedMealDetail" component={SavedMealDetail} options={{ title: 'Meal' }} />
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
        <Stack.Screen name="Explore" component={Explore} options={{ headerShown: false, title: 'Explore' }} />
        <Stack.Screen
          name="ActionSheet"
          component={ActionSheet}
          options={{ headerShown: false, presentation: 'transparentModal', animation: 'fade' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
    </SafeAreaProvider>
  );
}
