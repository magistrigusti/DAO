import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
} from '@ton/core';
import {
    OP_CHANGE_TAX,
    OP_CHANGE_TREASURY,
    OP_GAS_POOL_EXECUTE,
    OP_SET_RESERVE,
    OP_TOP_UP,
    OP_UPDATE_RATE,
    OP_WITHDRAW_DOM,
    OP_WITHDRAW_TON,
} from '../core/op_code';

const DEFAULT_DOM_PER_TON = 10_000_000n;
const DEFAULT_BASE_TON_COST = 50_000_000n;
const DEFAULT_TAX_MULTIPLIER = 300;
const DEFAULT_MESSAGE_TON_AMOUNT = 10_000_000n;

export type GasPoolConfig = {
    managerAddress: Address;
    proxyAddress: Address;
    domTreasuryAddress: Address;
    domBalance?: bigint;
    tonReserve?: bigint;
    domPerTonRate?: bigint;
    baseTonCost?: bigint;
    taxMultiplier?: number;
    messageTonAmount?: bigint;
    hasPendingTreasury?: boolean;
    pendingTreasuryAddress?: Address | null;
    pendingTreasuryTime?: bigint;
    hasPendingFeeConfig?: boolean;
    pendingBaseTonCost?: bigint;
    pendingTaxMultiplier?: number;
    pendingMessageTonAmount?: bigint;
    pendingFeeConfigTime?: bigint;
};

function buildFeeConfig(config: GasPoolConfig): Cell {
    return beginCell()
        .storeCoins(config.domPerTonRate ?? DEFAULT_DOM_PER_TON)
        .storeCoins(config.baseTonCost ?? DEFAULT_BASE_TON_COST)
        .storeUint(config.taxMultiplier ?? DEFAULT_TAX_MULTIPLIER, 16)
        .storeCoins(config.messageTonAmount ?? DEFAULT_MESSAGE_TON_AMOUNT)
        .endCell();
}

function buildPendingFeeConfig(config: GasPoolConfig): Cell {
    return beginCell()
        .storeCoins(config.pendingBaseTonCost ?? config.baseTonCost ?? DEFAULT_BASE_TON_COST)
        .storeUint(config.pendingTaxMultiplier ?? config.taxMultiplier ?? DEFAULT_TAX_MULTIPLIER, 16)
        .storeCoins(config.pendingMessageTonAmount ?? config.messageTonAmount ?? DEFAULT_MESSAGE_TON_AMOUNT)
        .storeUint(config.pendingFeeConfigTime ?? 0n, 64)
        .endCell();
}

export function gasPoolConfigToCell(config: GasPoolConfig): Cell {
    const hasPendingTreasury = config.hasPendingTreasury ?? false;
    const hasPendingFeeConfig = config.hasPendingFeeConfig ?? false;

    let builder = beginCell()
        .storeAddress(config.managerAddress)
        .storeAddress(config.proxyAddress)
        .storeAddress(config.domTreasuryAddress)
        .storeCoins(config.domBalance ?? 0n)
        .storeCoins(config.tonReserve ?? 0n)
        .storeRef(buildFeeConfig(config))
        .storeBit(hasPendingTreasury);

    if (hasPendingTreasury) {
        if (!config.pendingTreasuryAddress) {
            throw new Error('GasPool: pendingTreasuryAddress is required');
        }

        const pendingTreasuryRef = beginCell()
            .storeAddress(config.pendingTreasuryAddress)
            .storeUint(config.pendingTreasuryTime ?? 0n, 64)
            .endCell();

        builder = builder.storeRef(pendingTreasuryRef);
    }

    builder = builder.storeBit(hasPendingFeeConfig);

    if (hasPendingFeeConfig) {
        builder = builder.storeRef(buildPendingFeeConfig(config));
    }

    return builder.endCell();
}

export class GasPool implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromConfig(config: GasPoolConfig, code: Cell, workchain = 0) {
        const data = gasPoolConfigToCell(config);
        const init = { code, data };
        return new GasPool(contractAddress(workchain, init), init);
    }

    static createFromAddress(address: Address) {
        return new GasPool(address);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, { value });
    }

    async sendGasPoolExecute(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            jettonAmount: bigint;
            toOwner: Address;
            fromOwner: Address;
            maxFeeDom: bigint;
            queryId?: bigint;
        }
    ) {
        const body = beginCell()
            .storeUint(OP_GAS_POOL_EXECUTE, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeCoins(opts.jettonAmount)
            .storeAddress(opts.toOwner)
            .storeAddress(opts.fromOwner)
            .storeCoins(opts.maxFeeDom)
            .endCell();

        await provider.internal(via, {
            value: opts.value,
            body,
        });
    }

    async sendTopUp(provider: ContractProvider, via: Sender, opts: { value: bigint; queryId?: bigint }) {
        const body = beginCell()
            .storeUint(OP_TOP_UP, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .endCell();

        await provider.internal(via, { value: opts.value, body });
    }

    async sendUpdateRate(
        provider: ContractProvider,
        via: Sender,
        opts: { value: bigint; newRate: bigint; queryId?: bigint }
    ) {
        const body = beginCell()
            .storeUint(OP_UPDATE_RATE, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeCoins(opts.newRate)
            .endCell();

        await provider.internal(via, { value: opts.value, body });
    }

    async sendChangeTaxRequest(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            newBaseTonCost: bigint;
            newTaxMultiplier: number;
            newMessageTonAmount: bigint;
            queryId?: bigint;
        }
    ) {
        const body = beginCell()
            .storeUint(OP_CHANGE_TAX, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeUint(1, 8)
            .storeCoins(opts.newBaseTonCost)
            .storeUint(opts.newTaxMultiplier, 16)
            .storeCoins(opts.newMessageTonAmount)
            .endCell();

        await provider.internal(via, { value: opts.value, body });
    }

    async sendChangeTaxConfirm(provider: ContractProvider, via: Sender, opts: { value: bigint; queryId?: bigint }) {
        const body = beginCell()
            .storeUint(OP_CHANGE_TAX, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeUint(2, 8)
            .endCell();

        await provider.internal(via, { value: opts.value, body });
    }

    async sendChangeTaxCancel(provider: ContractProvider, via: Sender, opts: { value: bigint; queryId?: bigint }) {
        const body = beginCell()
            .storeUint(OP_CHANGE_TAX, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeUint(3, 8)
            .endCell();

        await provider.internal(via, { value: opts.value, body });
    }

    async sendWithdrawDom(
        provider: ContractProvider,
        via: Sender,
        opts: { value: bigint; amount: bigint; toOwner: Address; queryId?: bigint }
    ) {
        const body = beginCell()
            .storeUint(OP_WITHDRAW_DOM, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeCoins(opts.amount)
            .storeAddress(opts.toOwner)
            .endCell();

        await provider.internal(via, { value: opts.value, body });
    }

    async sendWithdrawTon(
        provider: ContractProvider,
        via: Sender,
        opts: { value: bigint; amount: bigint; toAddress: Address; queryId?: bigint }
    ) {
        const body = beginCell()
            .storeUint(OP_WITHDRAW_TON, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeCoins(opts.amount)
            .storeAddress(opts.toAddress)
            .endCell();

        await provider.internal(via, { value: opts.value, body });
    }

    async sendSetReserve(
        provider: ContractProvider,
        via: Sender,
        opts: { value: bigint; reserveTonNano: bigint; queryId?: bigint }
    ) {
        const body = beginCell()
            .storeUint(OP_SET_RESERVE, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeCoins(opts.reserveTonNano)
            .endCell();

        await provider.internal(via, { value: opts.value, body });
    }

    async sendChangeTreasuryRequest(
        provider: ContractProvider,
        via: Sender,
        opts: { value: bigint; newTreasuryAddress: Address; queryId?: bigint }
    ) {
        const body = beginCell()
            .storeUint(OP_CHANGE_TREASURY, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeUint(1, 8)
            .storeAddress(opts.newTreasuryAddress)
            .endCell();

        await provider.internal(via, { value: opts.value, body });
    }

    async sendChangeTreasuryConfirm(provider: ContractProvider, via: Sender, opts: { value: bigint; queryId?: bigint }) {
        const body = beginCell()
            .storeUint(OP_CHANGE_TREASURY, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeUint(2, 8)
            .endCell();

        await provider.internal(via, { value: opts.value, body });
    }

    async sendChangeTreasuryCancel(provider: ContractProvider, via: Sender, opts: { value: bigint; queryId?: bigint }) {
        const body = beginCell()
            .storeUint(OP_CHANGE_TREASURY, 32)
            .storeUint(opts.queryId ?? 0n, 64)
            .storeUint(3, 8)
            .endCell();

        await provider.internal(via, { value: opts.value, body });
    }

    async getPoolData(provider: ContractProvider) {
        const { stack } = await provider.get('getPoolData', []);

        const managerAddress = stack.readAddress();

        return {
            managerAddress,
            adminAddress: managerAddress,
            proxyAddress: stack.readAddress(),
            domTreasuryAddress: stack.readAddress(),
            domBalance: stack.readBigNumber(),
            tonReserve: stack.readBigNumber(),
            domPerTonRate: stack.readBigNumber(),
            baseTonCost: stack.readBigNumber(),
            taxMultiplier: stack.readBigNumber(),
            messageTonAmount: stack.readBigNumber(),
            availableTon: stack.readBigNumber(),
        };
    }

    async getCurrentDomFee(provider: ContractProvider) {
        const { stack } = await provider.get('getCurrentDomFee', []);
        return stack.readBigNumber();
    }

    async getPendingTreasury(provider: ContractProvider) {
        const { stack } = await provider.get('getPendingTreasury', []);

        return {
            hasPendingTreasury: stack.readBoolean(),
            pendingTreasuryAddress: stack.readAddressOpt(),
            pendingTreasuryTime: stack.readBigNumber(),
        };
    }

    async getPendingFeeConfig(provider: ContractProvider) {
        const { stack } = await provider.get('getPendingFeeConfig', []);

        return {
            hasPendingFeeConfig: stack.readBoolean(),
            pendingBaseTonCost: stack.readBigNumber(),
            pendingTaxMultiplier: stack.readBigNumber(),
            pendingMessageTonAmount: stack.readBigNumber(),
            pendingFeeConfigTime: stack.readBigNumber(),
        };
    }
}
