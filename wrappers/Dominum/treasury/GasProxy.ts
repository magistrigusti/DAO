import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
} from '@ton/core';
import {
    OP_CANCEL_CHANGE_POOL,
    OP_CONFIRM_CHANGE_POOL,
    OP_GAS_POOL_EXECUTE,
    OP_REQUEST_CHANGE_POOL,
    OP_SET_PROXY_WALLET_CONFIG,
} from '../core/op_code';

function readAddressOrNull(read: () => Address): Address | null {
    try {
        return read();
    } catch {
        return null;
    }
}

export type GasProxyConfig = {
    adminAddress: Address;
    realGasPoolAddress: Address;
    walletConfigReady?: boolean;
    masterAddress?: Address | null;
    jettonWalletCode?: Cell | null;
    hasPending?: boolean;
    pendingAddress?: Address | null;
    pendingTime?: bigint;
};

export function gasProxyConfigToCell(
    config: GasProxyConfig
): Cell {
    const walletConfigReady =
        config.walletConfigReady ?? false;
    const hasPending = config.hasPending ?? false;

    let builder = beginCell()
        .storeAddress(config.adminAddress)
        .storeAddress(config.realGasPoolAddress)
        .storeBit(walletConfigReady);

    if (walletConfigReady) {
        if (!config.masterAddress || !config.jettonWalletCode) {
            throw new Error(
                'GasProxy: masterAddress and jettonWalletCode are required when walletConfigReady = true'
            );
        }

        builder = builder
            .storeAddress(config.masterAddress)
            .storeRef(config.jettonWalletCode);
    }

    builder = builder.storeBit(hasPending);

    if (hasPending) {
        if (!config.pendingAddress) {
            throw new Error(
                'GasProxy: pendingAddress is required when hasPending = true'
            );
        }

        builder = builder
            .storeAddress(config.pendingAddress)
            .storeUint(config.pendingTime ?? 0n, 64);
    }

    return builder.endCell();
}

export class GasProxy implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: {
            code: Cell;
            data: Cell;
        }
    ) {}

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

    static createFromAddress(address: Address) {
        return new GasProxy(address);
    }

    async sendDeploy(
        provider: ContractProvider,
        via: Sender,
        value: bigint
    ) {
        await provider.internal(via, {
            value,
        });
    }

    // ========== ADMIN ==========
    async sendSetWalletConfig(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            masterAddress: Address;
            jettonWalletCode: Cell;
            queryId?: bigint;
        }
    ) {
        const body = beginCell()
            .storeUint(OP_SET_PROXY_WALLET_CONFIG, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeAddress(opts.masterAddress)
            .storeRef(opts.jettonWalletCode)
            .endCell();

        await provider.internal(via, {
            value: opts.value,
            body,
        });
    }

    async sendRequestChangePool(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            newGasPoolAddress: Address;
            queryId?: bigint;
        }
    ) {
        const body = beginCell()
            .storeUint(OP_REQUEST_CHANGE_POOL, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeAddress(opts.newGasPoolAddress)
            .endCell();

        await provider.internal(via, {
            value: opts.value,
            body,
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
        const body = beginCell()
            .storeUint(OP_CONFIRM_CHANGE_POOL, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .endCell();

        await provider.internal(via, {
            value: opts.value,
            body,
        });
    }

    async sendCancelChangePool(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryId?: bigint;
        }
    ) {
        const body = beginCell()
            .storeUint(OP_CANCEL_CHANGE_POOL, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .endCell();

        await provider.internal(via, {
            value: opts.value,
            body,
        });
    }

    // ========== TEST / DEBUG ==========
    async sendGasPoolExecute(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            jettonAmount: bigint;
            toOwner: Address;
            fromOwner: Address;
            treasuryFee: bigint;
            gasPoolFee: bigint;
            queryId?: bigint;
        }
    ) {
        const body = beginCell()
            .storeUint(OP_GAS_POOL_EXECUTE, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeCoins(opts.jettonAmount)
            .storeAddress(opts.toOwner)
            .storeAddress(opts.fromOwner)
            .storeCoins(opts.treasuryFee)
            .storeCoins(opts.gasPoolFee)
            .endCell();

        await provider.internal(via, {
            value: opts.value,
            body,
        });
    }

    // ========== GETTERS ==========
    async getProxyData(provider: ContractProvider) {
        const { stack } = await provider.get(
            'getProxyData',
            []
        );

        return {
            adminAddress: stack.readAddress(),
            realGasPoolAddress: stack.readAddress(),
            hasPending: stack.readBoolean(),
        };
    }

    async getWalletConfig(provider: ContractProvider) {
        const { stack } = await provider.get(
            'getWalletConfig',
            []
        );

        const walletConfigReady = stack.readBoolean();
        const masterAddress = readAddressOrNull(() =>
            stack.readAddress()
        );

        return {
            walletConfigReady,
            masterAddress,
        };
    }

    async getPendingChange(provider: ContractProvider) {
        const { stack } = await provider.get(
            'getPendingChange',
            []
        );

        const hasPending = stack.readBoolean();
        const pendingAddress = readAddressOrNull(() =>
            stack.readAddress()
        );
        const pendingTime = stack.readBigNumber();

        return {
            hasPending,
            pendingAddress,
            pendingTime,
        };
    }
}