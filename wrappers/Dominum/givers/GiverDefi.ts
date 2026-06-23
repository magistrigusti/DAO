import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
} from '@ton/core';

export type GiverDefiConfig = {
  masterAddress: Address;
  treasuryPoolAddress: Address;
  jettonWalletCode: Cell;
  marketAddress: Address;
  foundryAddress: Address;
  defiTreasuryAddress: Address;
};

export function giverDefiConfigToCell(
  config: GiverDefiConfig
): Cell {
  const targets = beginCell()
    .storeAddress(config.marketAddress)
    .storeAddress(config.foundryAddress)
    .storeAddress(config.defiTreasuryAddress)
    .endCell();

  return beginCell()
    .storeAddress(config.masterAddress)
    .storeAddress(config.treasuryPoolAddress)
    .storeRef(config.jettonWalletCode)
    .storeRef(targets)
    .endCell();
}

export class GiverDefi implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: {
      code: Cell;
      data: Cell;
    }
  ) {}

  static createFromConfig(
    config: GiverDefiConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = giverDefiConfigToCell(config);
    const init = { code, data };

    return new GiverDefi(
      contractAddress(workchain, init),
      init
    );
  }

  static createFromAddress(address: Address) {
    return new GiverDefi(address);
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
      marketAddress: stack.readAddress(),
      foundryAddress: stack.readAddress(),
      defiTreasuryAddress: stack.readAddress(),
    };
  }
}
