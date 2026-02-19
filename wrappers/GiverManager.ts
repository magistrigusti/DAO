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

const OP_SET_WALLET = 0x41;

export type GiverManagerConfig = {
    ownerAddress: Address;
};

export function giverManagerConfigToCell(
    config: GiverManagerConfig
): Cell {
    return beginCell()
        .storeAddress(config.ownerAddress)
        .endCell();
}

export class GiverManager implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromAddress(address: Address) {
        return new GiverManager(address);
    }

    static createFromConfig(
        config: GiverManagerConfig,
        code: Cell,
        workchain = 0
    ) {
        const data = giverManagerConfigToCell(config);
        const init = { code, data };

        return new GiverManager(
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

    async sendSetWallet(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryId?: bigint;
            giverAddress: Address;
            walletAddress: Address;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OP_SET_WALLET, 32)
                .storeUint(opts.queryId ?? 0n, 64)
                .storeAddress(opts.giverAddress)
                .storeAddress(opts.walletAddress)
                .endCell(),
        });
    }
}
