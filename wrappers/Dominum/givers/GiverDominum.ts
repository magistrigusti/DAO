import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
} from '@ton/core';

export type GiverDominumConfig = {
  masterAddress: Address;
  gasPoolAddress: Address;
  jettonWalletCode: Cell;
  bankDominumAddress: Address;
  dominumFoundationAddress: Address;
};

export function giverDominumConfigToCell(
  config: GiverDominumConfig
): Cell {
  const targets = beginCell()
    .storeAddress(config.bankDominumAddress)
    .storeAddress(config.dominumFoundationAddress)
    .endCell();

  return beginCell()
    .storeAddress(config.masterAddress)
    .storeAddress(config.gasPoolAddress)
    .storeRef(config.jettonWalletCode)
    .storeRef(targets)
    .endCell();
}

export class GiverDominum implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: {
      code: Cell;
      data: Cell;
    }
  ) {}

  static createFromConfig(
    config: GiverDominumConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = giverDominumConfigToCell(config);
    const init = { code, data };

    return new GiverDominum(
      contractAddress(workchain, init),
      init
    );
  }

  static createFromAddress(address: Address) {
    return new GiverDominum(address);
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
      bankDominumAddress: stack.readAddress(),
      dominumFoundationAddress: stack.readAddress(),
    };
  }
}