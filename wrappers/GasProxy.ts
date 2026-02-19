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

const OP_REQUEST_CHANGE_POOL = 0xB0;
const OP_CONFIRM_CHANGE_POOL = 0xB1;
const OP_SET_PROXY_WALLET_CONFIG = 0xB4;

export type GasProxyConfig = {
    adminAddress: Address;
    realGasPoolAddress: Address | null;
    walletConfigReady: boolean;
    masterAddress?: Address | null;
    jettonWalletCode?: Cell;
    hasPending: boolean;
    pendingAddress?: Address | null;
    pendingTime?: bigint;
};

export function gasProxyConfigToCell(
    config: GasProxyConfig
): Cell {
    let builder = beginCell()
        .storeAddress(config.adminAddress)
        .storeAddress(config.realGasPoolAddress)
        .storeBit(config.walletConfigReady);

    if (config.walletConfigReady) {
        if (
            config.masterAddress === undefined
            || config.masterAddress === null
            || config.jettonWalletCode === undefined
        ) {
            throw new Error(
                'masterAddress и jettonWalletCode обязательны при walletConfigReady=true'
            );
        }

        builder = builder
            .storeAddress(config.masterAddress)
            .storeRef(config.jettonWalletCode);
    }

    builder = builder.storeBit(config.hasPending);

    if (config.hasPending) {
        builder = builder
            .storeAddress(config.pendingAddress ?? null)
            .storeUint(config.pendingTime ?? 0n, 64);
    }

    return builder.endCell();
}

export class GasProxy implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromAddress(address: Address) {
        return new GasProxy(address);
    }

    static createFromConfig(
        config: GasProxyConfig,
        code: Cell,
        workchain = 0
    ) {
        const data = gasProxyConfigToCell(config);
        const init = { code, data };

        return new GasProxy(
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

    async sendSetWalletConfig(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryId?: bigint;
            masterAddress: Address;
            walletCode: Cell;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OP_SET_PROXY_WALLET_CONFIG, 32)
                .storeUint(opts.queryId ?? 0n, 64)
                .storeAddress(opts.masterAddress)
                .storeRef(opts.walletCode)
                .endCell(),
        });
    }

    async sendRequestChangePool(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryId?: bigint;
            newPoolAddress: Address;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OP_REQUEST_CHANGE_POOL, 32)
                .storeUint(opts.queryId ?? 0n, 64)
                .storeAddress(opts.newPoolAddress)
                .endCell(),
        });
    }

    async sendConfirmChangePool(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryId?: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OP_CONFIRM_CHANGE_POOL, 32)
                .storeUint(opts.queryId ?? 0n, 64)
                .endCell(),
        });
    }

    async getWalletConfig(provider: ContractProvider) {
        const result = await provider.get(
            'getWalletConfig',
            []
        );

        return {
            ready: result.stack.readBoolean(),
            masterAddress: result.stack.readAddressOpt(),
        };
    }
}
