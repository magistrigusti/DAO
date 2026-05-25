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
  OP_REPLACE_GIVER,
} from '../core/op_code';

export type GiverManagerConfig = {
  ownerAddress: Address;
};

export function giverManagerConfigToCell(
  config: GiverManagerConfig
): Cell {
  return beginCell()
    .storeAddress(config.ownerAddress)
    .endCell();
}

export class GiverManager implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: {
      code: Cell;
      data: Cell;
    }
  ) {}

  static createFromConfig(
    config: GiverManagerConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = giverManagerConfigToCell(config);
    const init = { code, data };

    return new GiverManager(
      contractAddress(workchain, init),
      init
    );
  }

  static createFromAddress(address: Address) {
    return new GiverManager(address);
  }

  async sendDeploy(
    provider: ContractProvider,
    via: Sender,
    value: bigint
  ) {
    await provider.internal(via, { value });
  }

  async sendReplaceGiver(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      masterAddress: Address;
      oldGiverAddress: Address;
      newGiverAddress: Address;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_REPLACE_GIVER, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeAddress(opts.masterAddress)
      .storeAddress(opts.oldGiverAddress)
      .storeAddress(opts.newGiverAddress)
      .endCell();

    await provider.internal(via, {
      value: opts.value,
      body,
    });
  }

  async getManagerData(
    provider: ContractProvider
  ): Promise<Address> {
    const { stack } = await provider.get(
      'getManagerData',
      []
    );

    return stack.readAddress();
  }
}