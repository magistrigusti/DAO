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
  OP_REPLACE_MANAGER,
  OP_REPLACE_MINTER,
} from '../core/op_code';

export type MinterManagerConfig = {
  ownerAddress: Address;
};

export function minterManagerConfigToCell(config: MinterManagerConfig): Cell {
  return beginCell()
    .storeAddress(config.ownerAddress)
    .endCell();
}

export class MinterManager implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromConfig(config: MinterManagerConfig, code: Cell, workchain = 0) {
    const data = minterManagerConfigToCell(config);
    const init = { code, data };

    return new MinterManager(contractAddress(workchain, init), init);
  }

  async sendReplaceManager(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      masterAddress: Address;
      oldManagerAddress: Address;
      newManagerAddress: Address;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_REPLACE_MANAGER, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeAddress(opts.masterAddress)
      .storeAddress(opts.oldManagerAddress)
      .storeAddress(opts.newManagerAddress)
      .endCell();

    await provider.internal(via, {
      value: opts.value,
      body,
    });
  }

  static createFromAddress(address: Address) {
    return new MinterManager(address);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, { value });
  }

  async sendReplaceMinter(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      masterAddress: Address;
      oldMinterAddress: Address;
      newMinterAddress: Address;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_REPLACE_MINTER, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeAddress(opts.masterAddress)
      .storeAddress(opts.oldMinterAddress)
      .storeAddress(opts.newMinterAddress)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async getMinterManagerData(provider: ContractProvider) {
    const { stack } = await provider.get('getMinterManagerData', []);

    return stack.readAddress();
  }
}
