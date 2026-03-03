// ========== TONCONNECT PROVIDER ==========
// Placeholder — TonConnect SDK для RN требует manifest + storage
// Полная интеграция: @tonconnect/sdk + AsyncStorage + deep links
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@dom_wallet_address';

interface TonConnectContextValue {
  connected: boolean;
  address: string | null;
  connectWallet: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const TonConnectContext = createContext<TonConnectContextValue>({
  connected: false,
  address: null,
  connectWallet: async () => {},
  disconnect: async () => {},
});

export function useTonConnect() {
  return useContext(TonConnectContext);
}

export function TonConnectProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  const connectWallet = useCallback(async () => {
    // Placeholder: TonConnect.connect() → wallet.connect()
    // Пока симулируем — сохраняем тестовый адрес для проверки UI
    const testAddress = 'EQD...test';
    await AsyncStorage.setItem(STORAGE_KEY, testAddress);
    setAddress(testAddress);
    setConnected(true);
  }, []);

  const disconnect = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setAddress(null);
    setConnected(false);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        setAddress(stored);
        setConnected(true);
      }
    });
  }, []);

  return (
    <TonConnectContext.Provider
      value={{ connected, address, connectWallet, disconnect }}
    >
      {children}
    </TonConnectContext.Provider>
  );
}