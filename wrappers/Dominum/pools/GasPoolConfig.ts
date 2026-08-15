import {
  Address,
  beginCell,
  Cell,
  Dictionary,
} from '@ton/core';

export type GasPoolConfig = {
  treasuryPoolAddress: Address;
  masterAddress: Address;
  jettonWalletCode: Cell;
  masterConfigured?: boolean;
  taxMultiplier?: number;
  totalReceivedDom?: bigint;
  totalSpentTon?: bigint;
  totalExecuted?: bigint;
  pendingExecutions?: Dictionary<bigint, Cell> | null;
};

export function gasPoolConfigToCell(config: GasPoolConfig): Cell {
  return beginCell()
    .storeAddress(config.treasuryPoolAddress)
    .storeAddress(config.masterAddress)
    .storeRef(config.jettonWalletCode)
    .storeBit(config.masterConfigured ?? false)
    .storeUint(config.taxMultiplier ?? 300, 16)
    .storeCoins(config.totalReceivedDom ?? 0n)
    .storeCoins(config.totalSpentTon ?? 0n)
    .storeUint(config.totalExecuted ?? 0n, 64)
    .storeDict(config.pendingExecutions ?? null)
    .endCell();
}
