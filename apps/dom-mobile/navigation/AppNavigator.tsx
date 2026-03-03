// ========== НАВИГАЦИЯ ==========
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DashboardScreen from '../screens/DashboardScreen';
import DeployScreen from '../screens/DeployScreen';
import MintScreen from '../screens/MintScreen';
import MonitorScreen from '../screens/MonitorScreen';
import AssetsScreen from '../screens/AssetsScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootStackParamList = {
  Dashboard: undefined;
  Deploy: undefined;
  Mint: undefined;
  Monitor: undefined;
  Assets: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#e2e8f0',
        }}
      >
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Deploy" component={DeployScreen} />
        <Stack.Screen name="Mint" component={MintScreen} />
        <Stack.Screen name="Monitor" component={MonitorScreen} />
        <Stack.Screen name="Assets" component={AssetsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}