export const METADATA_URL =
    'https://raw.githubusercontent.com/magistrigusti/DAO/main/metadata/dom-metadata.json';

// Предыдущее значение: 1_000_000_000n = 1_000 DOM при 6 decimals.
// Testnet: первый mint = 1_000_000 DOM.
// 1_000_000 * 10^6 = 1_000_000_000_000
// Перед выходом в mainnet вернуть production-значение после финального решения по токеномике.
export const FIRST_MINT_AMOUNT = 1_000_000_000_000n;
export const TIMELOCK_WAIT_MS = 65_000;

export const DEPLOY_VALUES = {
    gasProxy: '0.1',
    gasPool: '0.5',
    giver: '0.05',
    giverManager: '0.05',
    master: '0.05',
    proxyConfig: '0.05',
    poolChange: '0.05',
    mint: '0.25',
} as const;