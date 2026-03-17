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
  OP_REFILL_POOL,
  OP_UPDATE_GAS_POOL,
  OP_WITHDRAW,
  OP_WITHDRAW_FROM_POOL,
  OP_WITHDRAW_JETTONS,
} from '../core/op_code';

export type BankDominumConfig = {
  ownerAddress: Address;
  gasPoolAddress: Address;
  domWalletAddress: Address;
};

export function bankDominumConfigToCell(
  config: BankDominumConfig
): Cell {
  return beginCell()
    .storeAddress(config.ownerAddress)
    .storeAddress(config.gasPoolAddress)
    .storeAddress(config.domWalletAddress)
    .endCell();
}

export class BankDominum implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(
    config: BankDominumConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = bankDominumConfigToCell(config);
    const init = { code, data };

    return new BankDominum(
      contractAddress(workchain, init), init
    );
  }
}