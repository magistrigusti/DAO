// ========== ТОЧКА ВХОДА DOM MOBILE ==========
import React from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import {
  TonConnectProvider,
  TonConnectAdapter,
} from './services/TonConnectProvider';
import { AppNavigator } from './navigation/AppNavigator';

// Для localhost — demo manifest. Для Vercel — свой.
const manifestUrl =
  typeof window !== 'undefined'
    ? window.location.hostname === 'localhost'
      ? 'https://tonconnect-sdk-demo-dapp.vercel.app/tonconnect-manifest.json'
      : `${window.location.origin}/tonconnect-manifest.json`
    : 'https://tonconnect-sdk-demo-dapp.vercel.app/tonconnect-manifest.json';

export default function App() {
  const content = (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </SafeAreaProvider>
  );

  if (Platform.OS === 'web') {
    return (
      <TonConnectUIProvider manifestUrl={manifestUrl}>
        <TonConnectAdapter>{content}</TonConnectAdapter>
      </TonConnectUIProvider>
    );
  }

  return <TonConnectProvider>{content}</TonConnectProvider>;
}