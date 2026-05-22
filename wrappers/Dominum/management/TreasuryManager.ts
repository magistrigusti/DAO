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
  OP_REPLACE_TREASURY_ADDRESS,
} from '../core/op_code';

export type TreasuryManagerConfig = {
  ownerAddress: Address;
};

export function treasuryManagerConfigToCell(config: TreasuryManagerConfig): Cell {
  return beginCell()
    .storeAddress(config.ownerAddress)
    .endCell();
}

export class TreasuryManager implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromConfig(config: TreasuryManagerConfig, code: Cell, workchain = 0) {
    const data = treasuryManagerConfigToCell(config);
    const init = { code, data };

    return new TreasuryManager(contractAddress(workchain, init), init);
  }

  static createFromAddress(address: Address) {
    return new TreasuryManager(address);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, { value });
  }

  async sendReplaceTreasuryAddress(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      treasuryPoolAddress: Address;
      oldAddress: Address;
      newAddress: Address;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_REPLACE_TREASURY_ADDRESS, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeAddress(opts.treasuryPoolAddress)
      .storeAddress(opts.oldAddress)
      .storeAddress(opts.newAddress)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async sendChangeTax(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      treasuryPoolAddress: Address;
      oldTaxMultiplier: number;
      newTaxMultiplier: number;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_CHANGE_TAX, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeAddress(opts.treasuryPoolAddress)
      .storeUint(opts.oldTaxMultiplier, 16)
      .storeUint(opts.newTaxMultiplier, 16)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async getTreasuryManagerData(provider: ContractProvider) {
    const { stack } = await provider.get('getTreasuryManagerData', []);

    return stack.readAddress();
  }
}