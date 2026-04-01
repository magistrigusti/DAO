export const METADATA_URL =
    'https://raw.githubusercontent.com/magistrigusti/DAO/main/metadata/dom-metadata.json';

export const FIRST_MINT_AMOUNT = 1_000_000_000n;
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