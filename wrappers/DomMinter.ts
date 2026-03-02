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

export type DomMinterConfig = {
    adminAddress: Address;
    masterAddress: Address;
    lastMintTime: bigint;
    isStarted: boolean;
};

export function domMinterConfigToCell(
    config: DomMinterConfig
): Cell {
    return beginCell()
        .storeAddress(config.adminAddress)
        .storeAddress(config.masterAddress)
        .storeUint(config.lastMintTime, 64)
        .storeBit(config.isStarted)
        .endCell();
}

export class DomMinter implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromAddress(address: Address) {
        return new DomMinter(address);
    }

    static createFromConfig(
        config: DomMinterConfig,
        code: Cell,
        workchain = 0
    ) {
        const data = domMinterConfigToCell(config);
        const init = { code, data };

        return new DomMinter(
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
            firstMintAmount?: bigint;
        }
    ) {
        let body = beginCell()
            .storeUint(OP_MINT, 32)
            .storeUint(opts.queryId ?? 0n, 64);

        if (opts.firstMintAmount !== undefined) {
            body = body.storeCoins(opts.firstMintAmount);
        }

        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: body.endCell(),
        });
    }

    async getMinterData(provider: ContractProvider) {
        const result = await provider.get('getMinterData', []);

        return {
            adminAddress: result.stack.readAddress(),
            masterAddress: result.stack.readAddress(),
            lastMintTime: result.stack.readBigNumber(),
            nextMintTime: result.stack.readBigNumber(),
            isStarted: result.stack.readBoolean(),
            mintAmount: result.stack.readBigNumber(),
        };
    }
}
