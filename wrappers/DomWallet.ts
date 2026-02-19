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
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromAddress(address: Address) {
        return new DomWallet(address);
    }

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

    async getWalletData(provider: ContractProvider) {
        const result = await provider.get('getWalletData', []);

        return {
            balance: result.stack.readBigNumber(),
            ownerAddress: result.stack.readAddress(),
            masterAddress: result.stack.readAddress(),
            gasPoolAddress: result.stack.readAddress(),
        };
    }
}
