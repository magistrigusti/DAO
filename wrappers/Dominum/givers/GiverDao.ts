import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
} from '@ton/core';

export type GiverDaoConfig = {
  masterAddress: Address;
  gasPoolAddress: Address;
  jettonWalletCode: Cell;
  bankDaoAddress: Address;
  daoFoundationAddress: Address;
};

export function giverDaoConfigToCell(
  config: GiverDaoConfig
): Cell {
  const targets = beginCell()
    .storeAddress(config.bankDaoAddress)
    .storeAddress(config.daoFoundationAddress)
    .endCell();

  return beginCell()
    .storeAddress(config.masterAddress)
    .storeAddress(config.gasPoolAddress)
    .storeRef(config.jettonWalletCode)
    .storeRef(targets)
    .endCell();
}

export class GiverDao implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: {
      code: Cell;
      data: Cell;
    }
  ) {}

  static createFromConfig(
    config: GiverDaoConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = giverDaoConfigToCell(config);
    const init = { code, data };

    return new GiverDao(
      contractAddress(workchain, init),
      init
    );
  }

  static createFromAddress(address: Address) {
    return new GiverDao(address);
  }

  async sendDeploy(
    provider: ContractProvider,
    via: Sender,
    value: bigint
  ) {
    await provider.internal(via, { value });
  }

  async getGiverData(provider: ContractProvider) {
    const { stack } = await provider.get(
      'getGiverData',
      []
    );

    return {
      masterAddress: stack.readAddress(),
      gasPoolAddress: stack.readAddress(),
      walletAddress: stack.readAddress(),
      bankDaoAddress: stack.readAddress(),
      daoFoundationAddress: stack.readAddress(),
    };
  }
}