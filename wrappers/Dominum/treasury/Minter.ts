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

export type MinterConfig = {
  ownerAddress: Address;
  masterAddress: Address;
};

export function minterConfigToCell(config: MinterConfig): Cell {
  return beginCell()
    .storeAddress(config.ownerAddress)
    .storeAddress(config.masterAddress)
    .endCell();
}

export class Minter implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromConfig(config: MinterConfig, code: Cell, workchain = 0) {
    const data = minterConfigToCell(config);
    const init = { code, data };

    return new Minter(contractAddress(workchain, init), init);
  }

  static createFromAddress(address: Address) {
    return new Minter(address);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, { value });
  }

  async sendMint(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; amount: bigint; queryId?: bigint }
  ) {
    const body = beginCell()
      .storeUint(OP_MINT, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.amount)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async getMinterData(provider: ContractProvider) {
    const { stack } = await provider.get('getMinterData', []);

    return {
      ownerAddress: stack.readAddress(),
      masterAddress: stack.readAddress(),
    };
  }
}