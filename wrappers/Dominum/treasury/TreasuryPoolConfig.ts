import {
  Address,
  beginCell,
  Cell,
  Dictionary,
} from '@ton/core';

export type TreasuryPoolConfig = {
  ownerAddress: Address;
  treasuryManagerAddress: Address;
  jettonWalletAddress?: Address;
  walletConfigured?: boolean;
  bankDaoAddress: Address;
  bankDefiAddress: Address;
  bankDominumAddress: Address;
  gasPoolAddress: Address;
  masterAddress?: Address;
  jettonWalletCode?: Cell;
  masterConfigured?: boolean;
  taxMultiplier?: number;
  totalReceivedDom?: bigint;
  totalSentDom?: bigint;
  totalSentTon?: bigint;
  hasPending?: boolean;
  pendingKind?: number;
  pendingTargetKind?: number;
  pendingOldAddress?: Address | null;
  pendingNewAddress?: Address | null;
  pendingOldValue?: number;
  pendingNewValue?: number;
  nextRouteId?: bigint;
  pendingRoutes?: Dictionary<bigint, Cell> | null;
};

export function treasuryPoolConfigToCell(
  config: TreasuryPoolConfig
): Cell {
  const bankTargets = beginCell()
    .storeAddress(config.bankDaoAddress)
    .storeAddress(config.bankDefiAddress)
    .endCell();
  const poolTargets = beginCell()
    .storeAddress(config.bankDominumAddress)
    .storeAddress(config.gasPoolAddress)
    .endCell();
  const targets = beginCell()
    .storeRef(bankTargets)
    .storeRef(poolTargets)
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
    .storeUint(config.pendingTargetKind ?? 0, 8)
    .storeAddress(config.pendingOldAddress ?? null)
    .storeAddress(config.pendingNewAddress ?? null)
    .storeUint(config.pendingOldValue ?? 0, 32)
    .storeUint(config.pendingNewValue ?? 0, 32)
    .endCell();
  const routing = beginCell()
    .storeUint(config.nextRouteId ?? 1n, 64)
    .storeDict(config.pendingRoutes ?? null)
    .endCell();
  const masterConfig = beginCell()
    .storeAddress(config.masterAddress ?? config.ownerAddress)
    .storeRef(config.jettonWalletCode ?? beginCell().endCell())
    .storeBit(config.masterConfigured ?? false)
    .endCell();
  const extra = beginCell()
    .storeRef(routing)
    .storeRef(masterConfig)
    .endCell();
  return beginCell()
    .storeAddress(config.ownerAddress)
    .storeAddress(config.treasuryManagerAddress)
    .storeAddress(
      config.jettonWalletAddress ?? config.ownerAddress
    )
    .storeBit(config.walletConfigured ?? false)
    .storeRef(targets)
    .storeRef(stats)
    .storeRef(pending)
    .storeRef(extra)
    .endCell();
}
