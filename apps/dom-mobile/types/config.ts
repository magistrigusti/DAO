// ========== ТИПЫ КОНФИГУРАЦИИ И КОНТРАКТОВ ==========
// Placeholder типы — далее подключаем из wrappers

export type NetworkType = 'mainnet' | 'testnet';

export interface DomConfig {
  metadataUrl: string;
  network: NetworkType;
  masterAddress?: string;
  minterAddress?: string;
  gasPoolAddress?: string;
  treasuryAddress?: string;
}