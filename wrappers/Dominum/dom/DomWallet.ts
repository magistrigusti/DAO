import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
} from '@ton/core';
const OP_TRANSFER = 0xf8a7ea5n;
const OP_BURN = 0x595f07bcn;

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
            contractAddress(workchain, init), init
        );
    }

    statuc createFromAddress(address: Address) {
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
        const body = beginCell()
    }
}