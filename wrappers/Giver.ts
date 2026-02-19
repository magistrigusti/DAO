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

export type GiverConfig = {
    managerAddress: Address;
    walletAddress: Address | null;
    firstTargetAddress: Address;
    secondTargetAddress: Address;
};

export function giverConfigToCell(config: GiverConfig): Cell {
    return beginCell()
        .storeAddress(config.managerAddress)
        .storeAddress(config.walletAddress)
        .storeAddress(config.firstTargetAddress)
        .storeAddress(config.secondTargetAddress)
        .endCell();
}

export class Giver implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromAddress(address: Address) {
        return new Giver(address);
    }

    static createFromConfig(
        config: GiverConfig,
        code: Cell,
        workchain = 0
    ) {
        const data = giverConfigToCell(config);
        const init = { code, data };

        return new Giver(
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

    async getGiverData(provider: ContractProvider) {
        const result = await provider.get('getGiverData', []);

        return {
            managerAddress: result.stack.readAddress(),
            walletAddress: result.stack.readAddressOpt(),
            firstTargetAddress: result.stack.readAddress(),
            secondTargetAddress: result.stack.readAddress(),
        };
    }
}
