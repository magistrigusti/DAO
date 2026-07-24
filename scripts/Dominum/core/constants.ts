export const METADATA_URL =
    'https://raw.githubusercontent.com/magistrigusti/DAO/main/metadata/dom-metadata.json';

export const FORWARDED_MESSAGE_WAIT_MS = 15_000;

export const DEPLOY_VALUES = {
    treasuryManager: '0.05', treasuryPool: '0.2', gasPool: '1',
    giverManager: '0.05', minterManager: '0.05', giver: '0.2',
    minter: '0.05', master: '0.05', roleConfig: '0.05',
    treasuryConfig: '0.05', gasPipeline: '0.08', mint: '0.35',
} as const;

export const FIRST_MINT_CONFIG = {
    amount: 1_000_000_000_000n, queryId: 61n, giverFeeDom: 1_500_000n,
    totalTransferCount: 9n, minimumGasPoolTonBalance: 1_000_000_000n,
    emptyAmount: 0n, initialRouteId: 1n, finalRouteId: 10n,
    allodiumShare: 25n, defiShare: 25n, daoShare: 25n,
    dominumShare: 25n, allodiumTransfers: 2n, defiTransfers: 3n,
    daoTransfers: 2n, dominumTransfers: 2n, defiMarketShare: 20n,
    defiFoundryShare: 40n, percentBase: 100n, pollAttemptStart: 1,
    pollAttemptStep: 1, pollAttemptCount: 60, pollDelayMs: 3_000,
} as const;

export const FIRST_MINT_AMOUNT = FIRST_MINT_CONFIG.amount;

export const MIN_GAS_POOL_BALANCE_FOR_FIRST_MINT =
    FIRST_MINT_CONFIG.minimumGasPoolTonBalance;