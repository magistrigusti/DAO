import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    Sender,
} from '@ton/core';
import {
    OP_BURN,
    OP_INTERNAL_TRANSFER,
    OP_TRANSFER,
} from '../core/op_code';

export type DomWalletConfig = {
    balance: bigint;
    ownerAddress: Address;
    masterAddress: Address;
    gasPoolAddress: Address;
    jettonWalletCode: Cell;
    pendingTransfers?: Dictionary<bigint, Cell> | null;
};

export function domWalletConfigToCell(config: DomWalletConfig): Cell {
    const builder = beginCell()
        .storeCoins(config.balance)
        .storeAddress(config.ownerAddress)
        .storeAddress(config.masterAddress)
        .storeAddress(config.gasPoolAddress)
        .storeRef(config.jettonWalletCode);

    if (config.pendingTransfers) {
        builder.storeDict(config.pendingTransfers);
    }

    return builder.endCell();
}

export class DomWallet implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromConfig(config: DomWalletConfig, code: Cell, workchain = 0) {
        const data = domWalletConfigToCell(config);
        const init = { code, data };
        return new DomWallet(contractAddress(workchain, init), init);
    }

    static createFromAddress(address: Address) {
        return new DomWallet(address);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, { value });
    }

    async sendTransfer(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            jettonAmount: bigint;
            toOwner: Address;
            paidFeeDom?: bigint;
            maxFeeDom?: bigint;
            responseDestination?: Address | null;
            queryId?: bigint;
        }
    ) {
        const paidFeeDom = opts.paidFeeDom ?? opts.maxFeeDom;

        if (paidFeeDom === undefined) {
            throw new Error('paidFeeDom is required');
        }

        const body = beginCell()
            .storeUint(OP_TRANSFER, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeCoins(opts.jettonAmount)
            .storeAddress(opts.toOwner)
            .storeAddress(opts.responseDestination ?? null)
            .storeCoins(paidFeeDom)
            .endCell();

        await provider.internal(via, {
            value: opts.value,
            body,
        });
    }

    async sendInternalTransfer(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            amount: bigint;
            fromOwner: Address;
            responseDestination?: Address | null;
            queryId?: bigint;
        }
    ) {
        const body = beginCell()
            .storeUint(OP_INTERNAL_TRANSFER, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeCoins(opts.amount)
            .storeAddress(opts.fromOwner)
            .storeAddress(opts.responseDestination ?? null)
            .endCell();

        await provider.internal(via, {
            value: opts.value,
            body,
        });
    }

    async sendBurn(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            amount: bigint;
            responseDestination?: Address | null;
            queryId?: bigint;
        }
    ) {
        const body = beginCell()
            .storeUint(OP_BURN, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeCoins(opts.amount)
            .storeAddress(opts.responseDestination ?? null)
            .endCell();

        await provider.internal(via, {
            value: opts.value,
            body,
        });
    }

    async getWalletData(provider: ContractProvider) {
        const { stack } = await provider.get('getWalletData', []);

        return {
            balance: stack.readBigNumber(),
            ownerAddress: stack.readAddress(),
            masterAddress: stack.readAddress(),
            gasPoolAddress: stack.readAddress(),
        };
    }

    async getPendingTransfer(provider: ContractProvider, queryId: bigint) {
        const { stack } = await provider.get('getPendingTransfer', [
            { type: 'int', value: queryId },
        ]);

        return {
            totalSpend: stack.readBigNumber(),
            found: stack.readBoolean(),
        };
    }
}
