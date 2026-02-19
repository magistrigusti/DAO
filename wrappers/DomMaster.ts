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

const OP_MINT = 0x15;

export type DomMasterConfig = {
    totalSupply: bigint;
    minterAddress: Address;
    gasPoolAddress: Address;
    giverAllodiumAddress: Address;
    giverDefiAddress: Address;
    giverDaoAddress: Address;
    giverDominumAddress: Address;
    content: Cell;
    jettonWalletCode: Cell;
};

export function domMasterConfigToCell(
    config: DomMasterConfig
): Cell {
    const giversCell = beginCell()
        .storeAddress(config.giverAllodiumAddress)
        .storeAddress(config.giverDefiAddress)
        .storeAddress(config.giverDaoAddress)
        .storeAddress(config.giverDominumAddress)
        .endCell();

    return beginCell()
        .storeCoins(config.totalSupply)
        .storeAddress(config.minterAddress)
        .storeAddress(config.gasPoolAddress)
        .storeRef(giversCell)
        .storeRef(config.content)
        .storeRef(config.jettonWalletCode)
        .endCell();
}

export class DomMaster implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromAddress(address: Address) {
        return new DomMaster(address);
    }

    static createFromConfig(
        config: DomMasterConfig,
        code: Cell,
        workchain = 0
    ) {
        const data = domMasterConfigToCell(config);
        const init = { code, data };

        return new DomMaster(
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

    async sendMint(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryId?: bigint;
            amount: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OP_MINT, 32)
                .storeUint(opts.queryId ?? 0n, 64)
                .storeCoins(opts.amount)
                .endCell(),
        });
    }

    async getTotalSupply(provider: ContractProvider) {
        const result = await provider.get(
            'getJettonData',
            []
        );

        return result.stack.readBigNumber();
    }

    async getWalletAddress(
        provider: ContractProvider,
        ownerAddress: Address
    ) {
        const result = await provider.get(
            'getWalletAddress',
            [
                {
                    type: 'slice',
                    cell: beginCell()
                        .storeAddress(ownerAddress)
                        .endCell(),
                },
            ]
        );

        return result.stack.readAddress();
    }
}
