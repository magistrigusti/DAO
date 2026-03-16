import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
} from '@ton/core';
import { OP_BURN, OP_TRANSFER } from '../core/op_code';

export type DomWalletConfig = {
    balance: bigint;
    ownerAddress: Address;
    masterAddress: Address;
    gasPoolAddress: Address;
    jettonWalletCode: Cell;
};

export function domWalletConfigToCell(
    config: DomWalletConfig
): Cell {
    return beginCell()
        .storeCoins(config.balance)
        .storeAddress(config.ownerAddress)
        .storeAddress(config.masterAddress)
        .storeAddress(config.gasPoolAddress)
        .storeRef(config.jettonWalletCode)
        .endCell();
}

export class DomWallet implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: {
            code: Cell;
            data: Cell;
        }
    ) {}

    static createFromConfig(
        config: DomWalletConfig,
        code: Cell,
        workchain = 0
    ) {
        const data = domWalletConfigToCell(config);
        const init = { code, data };

        return new DomWallet(
            contractAddress(workchain, init),
            init
        );
    }

    static createFromAddress(address: Address) {
        return new DomWallet(address);
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

    async sendTransfer(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            jettonAmount: bigint;
            toOwner: Address;
            responseDestination?: Address | null;
            queryId?: bigint;
        }
    ) {
        // ВАЖНО:
        // твой wallet.tolk читает только:
        // amount -> toOwner -> responseDestination
        // без custom_payload / forward_payload.
        const body = beginCell()
            .storeUint(OP_TRANSFER, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeCoins(opts.jettonAmount)
            .storeAddress(opts.toOwner)
            .storeAddress(
                opts.responseDestination ?? null
            )
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
            .storeAddress(
                opts.responseDestination ?? null
            )
            .endCell();

        await provider.internal(via, {
            value: opts.value,
            body,
        });
    }

    async getWalletData(
        provider: ContractProvider
    ) {
        const { stack } = await provider.get(
            'getWalletData',
            []
        );

        return {
            balance: stack.readBigNumber(),
            ownerAddress: stack.readAddress(),
            masterAddress: stack.readAddress(),
            gasPoolAddress: stack.readAddress(),
        };
    }
}