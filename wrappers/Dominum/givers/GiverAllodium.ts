import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
} from '@ton/core';

export type GiverAllodiumConfig = {
  masterAddress: Address;
  treasuryPoolAddress: Address;
  jettonWalletCode: Cell;
  frsAllodiumAddress: Address;
  allodiumFoundationAddress: Address;
};

export function giverAllodiumConfigToCell(
  config: GiverAllodiumConfig
): Cell {
  const targets = beginCell()
    .storeAddress(config.frsAllodiumAddress)
    .storeAddress(config.allodiumFoundationAddress)
    .endCell();

  return beginCell()
    .storeAddress(config.masterAddress)
    .storeAddress(config.treasuryPoolAddress)
    .storeRef(config.jettonWalletCode)
    .storeRef(targets)
    .endCell();
}

export class GiverAllodium implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: {
      code: Cell;
      data: Cell;
    }
  ) {}

  static createFromConfig(
    config: GiverAllodiumConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = giverAllodiumConfigToCell(config);
    const init = { code, data };

    return new GiverAllodium(
      contractAddress(workchain, init),
      init
    );
  }

  static createFromAddress(address: Address) {
    return new GiverAllodium(address);
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
      treasuryPoolAddress: stack.readAddress(),
      walletAddress: stack.readAddress(),
      frsAllodiumAddress: stack.readAddress(),
      allodiumFoundationAddress: stack.readAddress(),
    };
  }
}
