// ========== API КЛИЕНТ ==========
// Вызовы к /api (Vercel serverless).
// apiBase — из Settings (apiUrl). На web с тем же origin — пустая строка.
// =================================

export function getApiBase(apiUrl?: string): string {
  if (apiUrl) return apiUrl.replace(/\/$/, '');
  if (typeof window !== 'undefined') return '';
  return process.env.EXPO_PUBLIC_API_URL ?? '';
}

export interface CryptoAsset {
  _id?: string;
  type: 'jetton' | 'nft';
  symbol: string;
  name: string;
  masterAddress: string;
  network: 'mainnet' | 'testnet';
  metadataUrl?: string;
  createdAt?: string;
}

export interface StoredContracts {
  master?: string;
  gasProxy?: string;
  gasPool?: string;
  giverAllodium?: string;
  giverDefi?: string;
  giverDao?: string;
  giverDominum?: string;
  network?: 'mainnet' | 'testnet';
}

export async function fetchAssets(apiBase?: string): Promise<CryptoAsset[]> {
  const base = getApiBase(apiBase);
  const res = await fetch(`${base}/api/assets`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createAsset(
  asset: Omit<CryptoAsset, '_id' | 'createdAt'>,
  apiBase?: string
): Promise<CryptoAsset> {
  const base = getApiBase(apiBase);
  const res = await fetch(`${base}/api/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(asset),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchContracts(apiBase?: string): Promise<StoredContracts> {
  const base = getApiBase(apiBase);
  const res = await fetch(`${base}/api/contracts`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function saveContracts(
  contracts: Partial<StoredContracts>,
  apiBase?: string
): Promise<StoredContracts> {
  const base = getApiBase(apiBase);
  const res = await fetch(`${base}/api/contracts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contracts),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ========== ALLOWED WALLETS (whitelist по ролям) ==========

export type WalletRole = 'deploy' | 'mint' | 'monitor' | 'assets' | 'settings';

export async function fetchAllowedActions(
  address: string,
  apiBase?: string
): Promise<WalletRole[] | null> {
  const base = getApiBase(apiBase);
  try {
    const res = await fetch(`${base}/api/allowed-wallets?address=${encodeURIComponent(address)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.roles ?? [];
  } catch {
    return null;
  }
}

/** Если whitelist пуст — все действия. Иначе только те, что в roles. */
export function filterActionsByRoles<T extends { key: string }>(
  actions: T[],
  roles: WalletRole[] | null
): T[] {
  if (!roles || roles.length === 0) return actions;
  const roleMap: Record<string, WalletRole> = {
    Deploy: 'deploy',
    Mint: 'mint',
    Monitor: 'monitor',
    Assets: 'assets',
    Settings: 'settings',
  };
  return actions.filter((a) => roles.includes(roleMap[a.key] ?? ''));
}
