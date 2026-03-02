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

const OP_WITHDRAW = 0x30;
const OP_WITHDRAW_JETTONS = 0x31;

export type DomTreasuryConfig = {
    ownerAddress: Address;
    jettonWalletAddress: Address;
    bankDaoAddress: Address;
    bankDefiAddress: Address;
    bankDominumAddress: Address;
};

export function domTreasuryConfigToCell(
    config: DomTreasuryConfig
): Cell {
    return beginCell()
        .storeAddress(config.ownerAddress)
        .storeAddress(config.jettonWalletAddress)
        .storeAddress(config.bankDaoAddress)
        .storeAddress(config.bankDefiAddress)
        .storeAddress(config.bankDominumAddress)
        .endCell();
}

export class DomTreasury implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromAddress(address: Address) {
        return new DomTreasury(address);
    }

    static createFromConfig(
        config: DomTreasuryConfig,
        code: Cell,
        workchain = 0
    ) {
        const data = domTreasuryConfigToCell(config);
        const init = { code, data };

        return new DomTreasury(
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

    async sendWithdrawTon(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryId?: bigint;
            amount: bigint;
            toAddress: Address;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OP_WITHDRAW, 32)
                .storeUint(opts.queryId ?? 0n, 64)
                .storeCoins(opts.amount)
                .storeAddress(opts.toAddress)
                .endCell(),
        });
    }

    async sendWithdrawDom(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryId?: bigint;
            amount: bigint;
            toAddress: Address;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OP_WITHDRAW_JETTONS, 32)
                .storeUint(opts.queryId ?? 0n, 64)
                .storeCoins(opts.amount)
                .storeAddress(opts.toAddress)
                .endCell(),
        });
    }

    async getTreasuryData(provider: ContractProvider) {
        const result = await provider.get(
            'getTreasuryData',
            []
        );

        return {
            ownerAddress: result.stack.readAddress(),
            jettonWalletAddress: result.stack.readAddress(),
            bankDaoAddress: result.stack.readAddress(),
            bankDefiAddress: result.stack.readAddress(),
            bankDominumAddress: result.stack.readAddress(),
            tonBalance: result.stack.readBigNumber(),
        };
    }
}
