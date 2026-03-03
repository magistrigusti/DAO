// ========== ТОЧКА ВХОДА DOM MOBILE ==========
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TonConnectUIProvider } from '@tonconnect/ui-react-native';
import { AppNavigator } from './navigation/AppNavigator';

// Manifest URL для TonConnect — замени на свой
const MANIFEST_URL =
  'https://raw.githubusercontent.com/ton-connect/sdk/main/packages/ui-react-native/demo/manifest.json';

export default function App() {
  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </SafeAreaProvider>
    </TonConnectUIProvider>
  );
}