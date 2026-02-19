import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
} from '@ton/core';

export type GasPoolConfig = {
    adminAddress: Address;
    proxyAddress: Address;
    domTreasuryAddress: Address;
    domBalance: bigint;
    tonReserve: bigint;
    hasPendingTreasury: boolean;
    pendingTreasury?: Address | null;
    pendingTreasuryTime?: bigint;
};

export function gasPoolConfigToCell(
    config: GasPoolConfig
): Cell {
    let builder = beginCell()
        .storeAddress(config.adminAddress)
        .storeAddress(config.proxyAddress)
        .storeAddress(config.domTreasuryAddress)
        .storeCoins(config.domBalance)
        .storeCoins(config.tonReserve)
        .storeBit(config.hasPendingTreasury);

    if (config.hasPendingTreasury) {
        builder = builder
            .storeAddress(config.pendingTreasury ?? null)
            .storeUint(
                config.pendingTreasuryTime ?? 0n,
                64
            );
    }

    return builder.endCell();
}

export class GasPool implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromAddress(address: Address) {
        return new GasPool(address);
    }

    static createFromConfig(
        config: GasPoolConfig,
        code: Cell,
        workchain = 0
    ) {
        const data = gasPoolConfigToCell(config);
        const init = { code, data };

        return new GasPool(
            contractAddress(workchain, init),
            init
        );
    }

    async sendDeploy(
        provider: ContractProvider,
        via: Sender,
        value: bigint
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async getPoolData(provider: ContractProvider) {
        const result = await provider.get('getPoolData', []);

        return {
            adminAddress: result.stack.readAddress(),
            proxyAddress: result.stack.readAddress(),
            domTreasuryAddress: result.stack.readAddress(),
            domBalance: result.stack.readBigNumber(),
            tonReserve: result.stack.readBigNumber(),
            availableTon: result.stack.readBigNumber(),
        };
    }
}
