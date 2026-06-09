import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Truck, ClipboardList, User } from 'lucide-react-native';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { Montserrat_400Regular, Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { colors, typography } from './theme';

import LoadBoardScreen from './screens/LoadBoardScreen';
import InspectionsScreen from './screens/InspectionsScreen';
import InspectionDetailScreen from './screens/InspectionDetailScreen';
import NewPTIScreen from './screens/NewPTIScreen';
import ProfileScreen from './screens/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const MyTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.surface,
  },
};

function InspectionsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surfaceContainerLow,
        },
        headerTintColor: colors.onSurface,
        headerTitleStyle: {
          fontFamily: typography.bebas,
          fontSize: 24,
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen 
        name="InspectionsList" 
        component={InspectionsScreen} 
        options={{ title: 'Inspections' }}
      />
      <Stack.Screen 
        name="InspectionDetail" 
        component={InspectionDetailScreen} 
        options={{ title: 'Inspection Details', headerBackTitleVisible: false }}
      />
      <Stack.Screen 
        name="NewPTI" 
        component={NewPTIScreen} 
        options={{ title: 'New PTI', headerBackTitleVisible: false }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  let [fontsLoaded] = useFonts({
    'Bebas Neue': BebasNeue_400Regular,
    'Montserrat': Montserrat_400Regular,
    'Montserrat-SemiBold': Montserrat_600SemiBold,
    'Montserrat-Bold': Montserrat_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={MyTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              if (route.name === 'Load Board') {
                return <Truck color={color} size={size} />;
              } else if (route.name === 'Inspections') {
                return <ClipboardList color={color} size={size} />;
              } else if (route.name === 'Profile') {
                return <User color={color} size={size} />;
              }
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
            headerTitleStyle: {
              fontFamily: typography.bebas,
              fontSize: 24,
            }
          })}
        >
          <Tab.Screen name="Load Board" component={LoadBoardScreen} />
          <Tab.Screen 
            name="Inspections" 
            component={InspectionsStack} 
            options={{ headerShown: false }} // Stack handles its own headers
          />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
