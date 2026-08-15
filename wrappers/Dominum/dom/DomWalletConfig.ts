import {
  Address,
  beginCell,
  Cell,
  Dictionary,
} from '@ton/core';

export type DomWalletConfig = {
  balance: bigint;
  ownerAddress: Address;
  masterAddress: Address;
  treasuryPoolAddress: Address;
  jettonWalletCode: Cell;
  pendingTransfers?: Dictionary<bigint, Cell> | null;
  lastProtocolQueryId?: bigint;
  processedDeliveries?: Dictionary<bigint, Cell> | null;
  sourceReceipts?: Dictionary<bigint, Cell> | null;
};

export function domWalletConfigToCell(
  config: DomWalletConfig
): Cell {
  const builder = beginCell()
    .storeCoins(config.balance)
    .storeAddress(config.ownerAddress)
    .storeAddress(config.masterAddress)
    .storeAddress(config.treasuryPoolAddress)
    .storeRef(config.jettonWalletCode);
  const hasProtocolState =
    config.lastProtocolQueryId !== undefined ||
    config.processedDeliveries !== undefined ||
    config.sourceReceipts !== undefined;

  if (config.pendingTransfers || hasProtocolState) {
    builder.storeDict(config.pendingTransfers ?? null);
  }
  if (hasProtocolState) {
    const protocol = beginCell()
      .storeUint(config.lastProtocolQueryId ?? 0n, 64)
      .storeDict(config.processedDeliveries ?? null)
      .storeDict(config.sourceReceipts ?? null)
      .endCell();
    builder.storeRef(protocol);
  }
  return builder.endCell();
}
