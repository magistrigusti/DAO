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
    OP_PROTOCOL_TRANSFER,
    OP_TRANSFER,
} from '../core/op_code';

export type DomWalletConfig = {
    balance: bigint;
    ownerAddress: Address;
    masterAddress: Address;
    treasuryPoolAddress: Address;
    jettonWalletCode: Cell;
    pendingTransfers?: Dictionary<bigint, Cell> | null;
};

export function domWalletConfigToCell(config: DomWalletConfig): Cell {
    const builder = beginCell()
        .storeCoins(config.balance)
        .storeAddress(config.ownerAddress)
        .storeAddress(config.masterAddress)
        .storeAddress(config.treasuryPoolAddress)
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
            amount: bigint;
            destination: Address;
            responseDestination?: Address | null;
            customPayload?: Cell | null;
            forwardTonAmount?: bigint;
            forwardPayload?: Cell | null;
            queryId?: bigint;
        }
    ) {
        const body = beginCell()
            .storeUint(OP_TRANSFER, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeCoins(opts.amount)
            .storeAddress(opts.destination)
            .storeAddress(opts.responseDestination ?? null)
            .storeMaybeRef(opts.customPayload ?? null)
            .storeCoins(opts.forwardTonAmount ?? 0n);

        if (opts.forwardPayload) {
            body
                .storeBit(true)
                .storeRef(opts.forwardPayload);
        } else {
            body.storeBit(false);
        }

        await provider.internal(via, {
            value: opts.value,
            body: body.endCell(),
        });
    }

    async sendProtocolTransfer(
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
            .storeUint(OP_PROTOCOL_TRANSFER, 32)
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
            forwardTonAmount?: bigint;
            forwardPayload?: Cell | null;
            queryId?: bigint;
        }
    ) {
        const body = beginCell()
            .storeUint(OP_INTERNAL_TRANSFER, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeCoins(opts.amount)
            .storeAddress(opts.fromOwner)
            .storeAddress(opts.responseDestination ?? null)
            .storeCoins(opts.forwardTonAmount ?? 0n);

        if (opts.forwardPayload) {
            body
                .storeBit(true)
                .storeRef(opts.forwardPayload);
        } else {
            body.storeBit(false);
        }

        await provider.internal(via, {
            value: opts.value,
            body: body.endCell(),
        });
    }

    async sendBurn(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            amount: bigint;
            responseDestination?: Address | null;
            customPayload?: Cell | null;
            queryId?: bigint;
        }
    ) {
        const body = beginCell()
            .storeUint(OP_BURN, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeCoins(opts.amount)
            .storeAddress(opts.responseDestination ?? null)
            .storeMaybeRef(opts.customPayload ?? null)
            .endCell();

        await provider.internal(via, {
            value: opts.value,
            body,
        });
    }

    async getWalletData(provider: ContractProvider) {
        const { stack } = await provider.get('get_wallet_data', []);

        return {
            balance: stack.readBigNumber(),
            ownerAddress: stack.readAddress(),
            masterAddress: stack.readAddress(),
            jettonWalletCode: stack.readCell(),
        };
    }

    async getProtocolData(provider: ContractProvider) {
        const { stack } = await provider.get('get_protocol_data', []);

        return {
            treasuryPoolAddress: stack.readAddress(),
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
