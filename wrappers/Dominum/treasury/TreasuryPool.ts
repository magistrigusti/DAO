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
  OP_CANCEL_TREASURY_REQUEST,
  OP_CHANGE_TAX,
  OP_CONFIRM_TREASURY_REQUEST,
  OP_INIT_MASTER_CONFIG,
  OP_REFILL_POOL,
  OP_REPLACE_TREASURY_ADDRESS,
  OP_WITHDRAW,
  OP_WITHDRAW_FROM_POOL,
  OP_WITHDRAW_JETTONS,
} from '../core/op_code';

export type TreasuryPoolConfig = {
  ownerAddress: Address;
  treasuryManagerAddress: Address;
  jettonWalletAddress: Address;
  bankDaoAddress: Address;
  bankDefiAddress: Address;
  bankDominumAddress: Address;
  gasPoolAddress: Address;
  taxMultiplier?: number;
  totalReceivedDom?: bigint;
  totalSentDom?: bigint;
  totalSentTon?: bigint;
  hasPending?: boolean;
  pendingKind?: number;
  pendingOldAddress?: Address | null;
  pendingNewAddress?: Address | null;
  pendingOldValue?: number;
  pendingNewValue?: number;
};

export function treasuryPoolConfigToCell(config: TreasuryPoolConfig): Cell {
  const targets = beginCell()
    .storeAddress(config.bankDaoAddress)
    .storeAddress(config.bankDefiAddress)
    .storeAddress(config.bankDominumAddress)
    .storeAddress(config.gasPoolAddress)
    .endCell();

  const stats = beginCell()
    .storeUint(config.taxMultiplier ?? 300, 16)
    .storeCoins(config.totalReceivedDom ?? 0n)
    .storeCoins(config.totalSentDom ?? 0n)
    .storeCoins(config.totalSentTon ?? 0n)
    .endCell();

  const pending = beginCell()
    .storeBit(config.hasPending ?? false)
    .storeUint(config.pendingKind ?? 0, 8)
    .storeAddress(config.pendingOldAddress ?? null)
    .storeAddress(config.pendingNewAddress ?? null)
    .storeUint(config.pendingOldValue ?? 0, 32)
    .storeUint(config.pendingNewValue ?? 0, 32)
    .endCell();

  return beginCell()
    .storeAddress(config.ownerAddress)
    .storeAddress(config.treasuryManagerAddress)
    .storeAddress(config.jettonWalletAddress)
    .storeRef(targets)
    .storeRef(stats)
    .storeRef(pending)
    .endCell();
}

export class TreasuryPool implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromConfig(config: TreasuryPoolConfig, code: Cell, workchain = 0) {
    const data = treasuryPoolConfigToCell(config);
    const init = { code, data };

    return new TreasuryPool(contractAddress(workchain, init), init);
  }

  static createFromAddress(address: Address) {
    return new TreasuryPool(address);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, { value });
  }

  async sendInitMasterConfig(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      masterAddress: Address;
      jettonWalletCode: Cell;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_INIT_MASTER_CONFIG, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeAddress(opts.masterAddress)
      .storeRef(opts.jettonWalletCode)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async sendReplaceAddressRequest(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; oldAddress: Address; newAddress: Address; queryId?: bigint }
  ) {
    const body = beginCell()
      .storeUint(OP_REPLACE_TREASURY_ADDRESS, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeAddress(opts.oldAddress)
      .storeAddress(opts.newAddress)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async sendTaxRequest(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; oldTaxMultiplier: number; newTaxMultiplier: number; queryId?: bigint }
  ) {
    const body = beginCell()
      .storeUint(OP_CHANGE_TAX, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeUint(opts.oldTaxMultiplier, 16)
      .storeUint(opts.newTaxMultiplier, 16)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async sendConfirmRequest(provider: ContractProvider, via: Sender, opts: { value: bigint; queryId?: bigint }) {
    const body = beginCell()
      .storeUint(OP_CONFIRM_TREASURY_REQUEST, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async sendCancelRequest(provider: ContractProvider, via: Sender, opts: { value: bigint; queryId?: bigint }) {
    const body = beginCell()
      .storeUint(OP_CANCEL_TREASURY_REQUEST, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async sendWithdrawTon(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; amount: bigint; toAddress: Address; queryId?: bigint }
  ) {
    const body = beginCell()
      .storeUint(OP_WITHDRAW, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.amount)
      .storeAddress(opts.toAddress)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async sendWithdrawJettons(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; amount: bigint; toAddress: Address; queryId?: bigint }
  ) {
    const body = beginCell()
      .storeUint(OP_WITHDRAW_JETTONS, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.amount)
      .storeAddress(opts.toAddress)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async sendRefillPool(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; amount: bigint; queryId?: bigint }
  ) {
    const body = beginCell()
      .storeUint(OP_REFILL_POOL, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.amount)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async sendWithdrawFromPool(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; amount: bigint; queryId?: bigint }
  ) {
    const body = beginCell()
      .storeUint(OP_WITHDRAW_FROM_POOL, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.amount)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async getTreasuryPoolData(provider: ContractProvider) {
    const { stack } = await provider.get('getTreasuryPoolData', []);

    return {
      ownerAddress: stack.readAddress(),
      treasuryManagerAddress: stack.readAddress(),
      jettonWalletAddress: stack.readAddress(),
      bankDaoAddress: stack.readAddress(),
      bankDefiAddress: stack.readAddress(),
      bankDominumAddress: stack.readAddress(),
      gasPoolAddress: stack.readAddress(),
      taxMultiplier: stack.readBigNumber(),
      totalReceivedDom: stack.readBigNumber(),
      totalSentDom: stack.readBigNumber(),
      totalSentTon: stack.readBigNumber(),
    };
  }

  async getTreasuryPendingData(provider: ContractProvider) {
    const { stack } = await provider.get('getTreasuryPendingData', []);

    return {
      hasPending: stack.readBoolean(),
      pendingKind: stack.readBigNumber(),
      pendingOldAddress: stack.readAddressOpt(),
      pendingNewAddress: stack.readAddressOpt(),
      pendingOldValue: stack.readBigNumber(),
      pendingNewValue: stack.readBigNumber(),
    };
  }

  async isTreasuryTargetAllowed(provider: ContractProvider, candidate: Address) {
    const { stack } = await provider.get('isTreasuryTargetAllowed', [
      { type: 'slice', cell: beginCell().storeAddress(candidate).endCell() },
    ]);

    return stack.readBoolean();
  }
}
