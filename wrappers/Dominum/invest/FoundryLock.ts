import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Dictionary,
  Sender,
} from '@ton/core';
import { OP_SET_RELEASE, OP_UNLOCK_MONTH } from '../core/op_code';

export type FoundryLockConfig = {
  ownerAddress: Address;
  walletAddress: Address;
  releaseAddress: Address;
  totalReceived?: bigint;
  totalLocked?: bigint;
  totalUnlocked?: bigint;
  totalFeePaid?: bigint;
  totalReturnedFee?: bigint;
  lockBuckets?: Dictionary<bigint, Cell> | null;
};

export function foundryLockConfigToCell(config: FoundryLockConfig): Cell {
  const lockBuckets =
    config.lockBuckets ??
    Dictionary.empty(Dictionary.Keys.BigUint(64), Dictionary.Values.Cell());

  const stats = beginCell()
    .storeCoins(config.totalReceived ?? 0n)
    .storeCoins(config.totalLocked ?? 0n)
    .storeCoins(config.totalUnlocked ?? 0n)
    .storeCoins(config.totalFeePaid ?? 0n)
    .storeCoins(config.totalReturnedFee ?? 0n)
    .storeDict(lockBuckets)
    .endCell();

  return beginCell()
    .storeAddress(config.ownerAddress)
    .storeAddress(config.walletAddress)
    .storeAddress(config.releaseAddress)
    .storeRef(stats)
    .endCell();
}

export class FoundryLock implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromConfig(config: FoundryLockConfig, code: Cell, workchain = 0) {
    const data = foundryLockConfigToCell(config);
    const init = { code, data };

    return new FoundryLock(contractAddress(workchain, init), init);
  }

  static createFromAddress(address: Address) {
    return new FoundryLock(address);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, { value });
  }

  async sendUnlockMonth(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; month: bigint; queryId?: bigint }
  ) {
    const body = beginCell()
      .storeUint(OP_UNLOCK_MONTH, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeUint(opts.month, 64)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async sendSetRelease(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; releaseAddress: Address; queryId?: bigint }
  ) {
    const body = beginCell()
      .storeUint(OP_SET_RELEASE, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeAddress(opts.releaseAddress)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async getFoundryLockData(provider: ContractProvider) {
    const { stack } = await provider.get('getFoundryLockData', []);

    return {
      ownerAddress: stack.readAddress(),
      walletAddress: stack.readAddress(),
      releaseAddress: stack.readAddress(),
      totalReceived: stack.readBigNumber(),
      totalLocked: stack.readBigNumber(),
      totalUnlocked: stack.readBigNumber(),
      totalFeePaid: stack.readBigNumber(),
      totalReturnedFee: stack.readBigNumber(),
      currentMonth: stack.readBigNumber(),
    };
  }

  async getLockedBucket(provider: ContractProvider, month: bigint) {
    const { stack } = await provider.get('getLockedBucket', [
      { type: 'int', value: month },
    ]);

    return {
      amount: stack.readBigNumber(),
      found: stack.readBoolean(),
    };
  }

  async getNextUnlockMonth(provider: ContractProvider) {
    const { stack } = await provider.get('getNextUnlockMonth', []);

    return stack.readBigNumber();
  }
}