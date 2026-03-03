// ========== TONCONNECT PROVIDER ==========
// Web: TonConnectUIProvider + TonConnectAdapter (реальные кошельки)
// Native: placeholder (manifest + deep links позже)
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@dom_wallet_address';

export interface TonConnectContextValue {
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

// ========== ADAPTER ДЛЯ WEB (TonConnect UI) ==========
// Использует useTonWallet, useTonConnectUI из @tonconnect/ui-react
import { useTonWallet, useTonConnectUI } from '@tonconnect/ui-react';

export function TonConnectAdapter({ children }: { children: React.ReactNode }) {
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();

  const connected = !!wallet;
  const address = wallet?.account?.address ?? null;

  const connectWallet = useCallback(async () => {
    tonConnectUI?.openModal();
  }, [tonConnectUI]);

  const disconnect = useCallback(async () => {
    await tonConnectUI?.disconnect();
  }, [tonConnectUI]);

  const value: TonConnectContextValue = {
    connected,
    address,
    connectWallet,
    disconnect,
  };

  return (
    <TonConnectContext.Provider value={value}>
      {children}
    </TonConnectContext.Provider>
  );
}

// ========== PROVIDER ДЛЯ NATIVE (placeholder) ==========
export function TonConnectProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  const connectWallet = useCallback(async () => {
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