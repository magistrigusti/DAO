// ========== СЕРВИС ХРАНЕНИЯ КОНФИГА ==========
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  CONFIG: '@dom_mobile_config',
  CONTRACTS: '@dom_mobile_contracts',
} as const;

export interface StoredContracts {
  master?: string;
  minter?: string;
  gasProxy?: string;
  gasPool?: string;
  treasury?: string;
  giverAllodium?: string;
  giverDefi?: string;
  giverDao?: string;
  giverDominum?: string;
  network?: 'mainnet' | 'testnet';
}

export interface StoredConfig {
  metadataUrl: string;
  apiUrl: string;
  network: 'mainnet' | 'testnet';
}

const DEFAULT_CONFIG: StoredConfig = {
  metadataUrl: 'https://dominum.vercel.app',
  apiUrl: '',
  network: 'testnet',
};

export async function getConfig(): Promise<StoredConfig> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.CONFIG);
    if (raw) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_CONFIG;
}

export async function setConfig(config: Partial<StoredConfig>): Promise<void> {
  const current = await getConfig();
  await AsyncStorage.setItem(
    STORAGE_KEYS.CONFIG,
    JSON.stringify({ ...current, ...config })
  );
}

export async function getContracts(): Promise<StoredContracts> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.CONTRACTS);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

export async function setContracts(contracts: Partial<StoredContracts>): Promise<void> {
  const current = await getContracts();
  await AsyncStorage.setItem(
    STORAGE_KEYS.CONTRACTS,
    JSON.stringify({ ...current, ...contracts })
  );
}