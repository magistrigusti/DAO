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
  OP_CHANGE_TREASURY,
  OP_GAS_POOL_EXECUTE,
  OP_SET_RESERVE,
  OP_TOP_UP,
  OP_WITHDRAW_DOM,
  OP_WITHDRAW_TON,
} from '../core/op_code';

function readAddressOrNull(read: () => Address): Address | null {
  try {
    return read();
  } catch {
    return null;
  }
}

export type GasPoolConfig = {
  adminAddress: Address;
  proxyAddress: Address;
  domTreasuryAddress: Address;
  domBalance: bigint;
  tonReserve: bigint;
  hasPendingTreasury?: boolean;
  pendingTreasuryAddress?: Address | null;
  pendingTreasuryTime?: bigint;
};

export function gasPoolConfigToCell(
  config: GasPoolConfig
): Cell {
  const hasPendingTreasury = config.hasPendingTreasury ?? false;

  let builder = beginCell()
    .storeAddress(config.adminAddress)
    .storeAddress(config.proxyAddress)
    .storeAddress(config.domTreasuryAddress)
    .storeCoins(config.domBalance)
    .storeCoins(config.tonReserve)
    .storeBit(hasPendingTreasury);

  if (hasPendingTreasury) {
    if (!config.pendingTreasuryAddress) {
      throw new Error(
        'GasPool: pendingTreasuryAddress is required when hasPendingTreasury = true'
      );
    }

    builder = builder
      .storeAddress(config.pendingTreasuryAddress)
      .storeUint(config.pendingTreasuryTime ?? 0n, 64);
  }

  return builder.endCell();
}

export class GasPool implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: {
      code: Cell;
      data: Cell;
    }
  ) {}

  static createFromConfig(
    config: GasPoolConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = gasPoolConfigCell(config);
    const init = { code, data };

    return new GasPool(
      contractAddress(workchain, init), init
    );
  }

  static createFromAddress(address: Address) {
    return new GasPool(address);
  }

  
}