import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Truck, ClipboardList, User, Shield } from 'lucide-react-native';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { Montserrat_400Regular, Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { colors, typography } from './theme';
import { AuthProvider, useAuth } from './context/AuthContext';
import './lib/firebase';

import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import AuthLoadingScreen from './screens/AuthLoadingScreen';
import LoadBoardScreen from './screens/LoadBoardScreen';
import AdminLoadsScreen from './screens/AdminLoadsScreen';
import LoadDetailScreen from './screens/LoadDetailScreen';
import InspectionsScreen from './screens/InspectionsScreen';
import AdminInspectionsScreen from './screens/AdminInspectionsScreen';
import InspectionDetailScreen from './screens/InspectionDetailScreen';
import NewPTIScreen from './screens/NewPTIScreen';
import ProfileScreen from './screens/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();

const MyTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.surface,
  },
};

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.surfaceContainerLow },
  headerTintColor: colors.onSurface,
  headerTitleStyle: { fontFamily: typography.bebas, fontSize: 24 },
  headerShadowVisible: false,
};

const tabScreenOptions = ({ route }) => ({
  tabBarIcon: ({ color, size }) => {
    if (route.name === 'Load Board' || route.name === 'All Loads') return <Truck color={color} size={size} />;
    if (route.name === 'Inspections' || route.name === 'All Inspections') return <ClipboardList color={color} size={size} />;
    if (route.name === 'Profile') return <User color={color} size={size} />;
    return <Shield color={color} size={size} />;
  },
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.onSurfaceVariant,
  tabBarStyle: {
    backgroundColor: colors.surfaceContainerLow,
    borderTopColor: colors.outlineVariant,
    paddingBottom: 5,
    height: 60,
  },
  headerStyle: {
    backgroundColor: colors.surfaceContainerLow,
    shadowColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  headerTintColor: colors.onSurface,
  headerTitleStyle: { fontFamily: typography.bebas, fontSize: 24 },
});

function DriverLoadsStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="LoadBoard" component={LoadBoardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="LoadDetail" component={LoadDetailScreen} options={{ title: 'Load Details', headerBackTitleVisible: false }} />
    </Stack.Navigator>
  );
}

function AdminLoadsStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="AdminLoadsList" component={AdminLoadsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="LoadDetail" component={LoadDetailScreen} options={{ title: 'Load Details', headerBackTitleVisible: false }} />
    </Stack.Navigator>
  );
}

function InspectionsStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="InspectionsList" component={InspectionsScreen} options={{ title: 'Inspections' }} />
      <Stack.Screen name="InspectionDetail" component={InspectionDetailScreen} options={{ title: 'Inspection Details', headerBackTitleVisible: false }} />
      <Stack.Screen name="NewPTI" component={NewPTIScreen} options={{ title: 'New PTI', headerBackTitleVisible: false }} />
    </Stack.Navigator>
  );
}

function AdminInspectionsStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="AdminInspectionsList" component={AdminInspectionsScreen} options={{ title: 'All Inspections' }} />
      <Stack.Screen name="InspectionDetail" component={InspectionDetailScreen} options={{ title: 'Inspection Details', headerBackTitleVisible: false }} />
    </Stack.Navigator>
  );
}

function DriverTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Load Board" component={DriverLoadsStack} options={{ headerShown: false }} />
      <Tab.Screen name="Inspections" component={InspectionsStack} options={{ headerShown: false }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="All Loads" component={AdminLoadsStack} options={{ headerShown: false }} />
      <Tab.Screen name="All Inspections" component={AdminInspectionsStack} options={{ headerShown: false }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, profile, loading } = useAuth();

  if (loading) return <AuthLoadingScreen />;

  return (
    <NavigationContainer theme={MyTheme}>
      {!user || !profile ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="SignUp" component={SignUpScreen} />
        </AuthStack.Navigator>
      ) : profile.role === 'admin' ? (
        <AdminTabs />
      ) : (
        <DriverTabs />
      )}
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'Bebas Neue': BebasNeue_400Regular,
    Montserrat: Montserrat_400Regular,
    'Montserrat-SemiBold': Montserrat_600SemiBold,
    'Montserrat-Bold': Montserrat_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
