// ========== TONCONNECT PROVIDER ==========
// Placeholder — TonConnect SDK для RN требует manifest + storage
// Полная интеграция: @tonconnect/sdk + AsyncStorage + deep links
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TonConnectContextValue {
  connected: boolean;
  address: string | null;
}

const TonConnectContext = createContext<TonConnectContextValue>({
  connected: false,
  address: null,
});

export function useTonConnect() {
  return useContext(TonConnectContext);
}

export function TonConnectProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    // Placeholder: интеграция с @tonconnect/sdk
    // await TonConnect.init({ manifestUrl, storage: AsyncStorage })
    setConnected(false);
    setAddress(null);
  }, []);

  return (
    <TonConnectContext.Provider value={{ connected, address }}>
      {children}
    </TonConnectContext.Provider>
  );
}