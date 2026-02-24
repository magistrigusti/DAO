export type NetworkKind =
    | 'mainnet'
    | 'testnet'
    | 'custom';

export type MonitorConfig = {
    network: NetworkKind;
    tonEndpoint: string;
    tonApiKey?: string;
    gasPoolAddress: string;
    marketMakerAddress?: string;
    pollIntervalMs: number;
    outputFilePath: string;
    domDecimals: number;
    tonDecimals: number;
};

export type GasPoolRawState = {
    readAt: string;
    readAtMs: number;
    address: string;
    adminAddress: string;
    proxyAddress: string;
    domTreasuryAddress: string;
    domBalanceNano: bigint;
    tonReserveNano: bigint;
    availableTonNano: bigint;
};

export type MarketMakerRawState = {
    readAt: string;
    readAtMs: number;
    address: string;
    ownerAddress: string;
    walletAddress: string;
    walletGasPoolAddress: string;
    whitelistCount: number;
    domBalanceNano: bigint;
    tonBalanceNano: bigint;
};

export type VolumeDelta = {
    domDelta: string;
    tonDelta: string;
    intervalMs: number | null;
};

export type GasPoolView = {
    readAt: string;
    address: string;
    adminAddress: string;
    proxyAddress: string;
    domTreasuryAddress: string;
    priceTonPerDom: string;
    balances: {
        dom: string;
        tonReserve: string;
        tonAvailable: string;
    };
    raw: {
        domBalanceNano: string;
        tonReserveNano: string;
        availableTonNano: string;
    };
    volumes: VolumeDelta;
};

export type MarketMakerView = {
    readAt: string;
    address: string;
    ownerAddress: string;
    walletAddress: string;
    walletGasPoolAddress: string;
    whitelistCount: number;
    balances: {
        dom: string;
        ton: string;
    };
    raw: {
        domBalanceNano: string;
        tonBalanceNano: string;
    };
    volumes: VolumeDelta;
};

export type MonitorSnapshot = {
    generatedAt: string;
    network: NetworkKind;
    endpoint: string;
    pools: {
        gasPool: GasPoolView;
        marketMaker?: MarketMakerView;
    };
};
