// ========== ТОЧКА ВХОДА DOM MOBILE ==========
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TonConnectProvider } from './services/TonConnectProvider';
import { AppNavigator } from './navigation/AppNavigator';

export default function App() {
  return (
    <TonConnectProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </SafeAreaProvider>
    </TonConnectProvider>
  );
}