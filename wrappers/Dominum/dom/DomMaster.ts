import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
} from '@ton/core';
import { OP_MINT } from '../core/op_code';

export type DomMasterConfig = {
    totalSupply: bigint;
    ownerAddress: Address;
    lastMintTime: bigint;
    isStarted: boolean;
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
    const giversFirst = beginCell()
        .storeAddress(config.giverAllodiumAddress)
        .storeAddress(config.giverDefiAddress)
        .endCell();

    const giversSecond = beginCell()
        .storeAddress(config.giverDaoAddress)
        .storeAddress(config.giverDominumAddress)
        .endCell();

    return beginCell()
        .storeCoins(config.totalSupply)
        .storeAddress(config.ownerAddress)
        .storeUint(config.lastMintTime, 64)
        .storeBit(config.isStarted)
        .storeAddress(config.gasPoolAddress)
        .storeRef(giversFirst)
        .storeRef(giversSecond)
        .storeRef(config.content)
        .storeRef(config.jettonWalletCode)
        .endCell();
}

export class DomMaster implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: {
            code: Cell;
            data: Cell;
        }
    ) {}

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

    static createFromAddress(address: Address) {
        return new DomMaster(address);
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

    async sendMint(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            amount: bigint;
            queryId?: bigint;
        }
    ) {
        const body = beginCell()
            .storeUint(OP_MINT, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeCoins(opts.amount)
            .endCell();

        await provider.internal(via, {
            value: opts.value,
            body,
        });
    }

    async getJettonData(
        provider: ContractProvider
    ) {
        const { stack } = await provider.get(
            'getJettonData',
            []
        );

        return {
            totalSupply: stack.readBigNumber(),
            mintable: stack.readBigNumber(),
            ownerAddress: stack.readAddress(),
            content: stack.readCell(),
            jettonWalletCode: stack.readCell(),
        };
    }

    async getWalletAddress(
        provider: ContractProvider,
        ownerAddress: Address
    ) {
        const { stack } = await provider.get(
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

        return stack.readAddress();
    }

    async getMasterData(
        provider: ContractProvider
    ) {
        const { stack } = await provider.get(
            'getMasterData',
            []
        );

        return {
            ownerAddress: stack.readAddress(),
            gasPoolAddress: stack.readAddress(),
            lastMintTime: stack.readBigNumber(),
            nextMintTime: stack.readBigNumber(),
            isStarted: stack.readBoolean(),
        };
    }

    async getMintRules(
        provider: ContractProvider
    ) {
        const { stack } = await provider.get(
            'getMintRules',
            []
        );

        return {
            minMintAmount: stack.readBigNumber(),
            maxMintAmount: stack.readBigNumber(),
            mintInterval: stack.readBigNumber(),
        };
    }

    async canMintNow(
        provider: ContractProvider
    ) {
        const { stack } = await provider.get(
            'canMintNow',
            []
        );

        return stack.readBoolean();
    }

    async getCanMintNow(
        provider: ContractProvider
    ) {
        return this.canMintNow(provider);
    }

    async getGiversData(
        provider: ContractProvider
    ) {
        const { stack } = await provider.get(
            'getGiversData',
            []
        );

        return {
            giverAllodiumAddress: stack.readAddress(),
            giverDefiAddress: stack.readAddress(),
            giverDaoAddress: stack.readAddress(),
            giverDominumAddress: stack.readAddress(),
        };
    }
}