import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
} from '@ton/core';

export type DomMasterConfig = {
  totalSupply: bigint;
  minterAddress: Address;
  gasPoolAddress: Address;
  giverAllodiumAddress: Address;
  giverDefiAddress: Address;
  giverDaoAddress: Address;
  giverDominumAddress: Address;
  content: Cell;
  jettonWalletCode: Cell;
};

export function domMasterConfigToCell(config: DomMasterConfig): Cell {
  const giversFirst = beginCell()
      .storeAddress(config.giverAllodiumAddress)
      .storeAddress(config.giverDefiAddress)
      .endCell();
  const giversSecond = beginCell()
      .storeAddress(config.giverDaoAddress)
      .storeAddress(config.giverDominumAddress)
      .endCell();

  return beginCell()
      .storeCoins(config.totalSupply)
      .storeAddress(config.minterAddress)
      .storeAddress(config.gasPoolAddress)
      .storeRef(giversFirst)
      .storeRef(giversSecond)
      .storeRef(config.content)
      .storeRef(config.jettonWalletCode)
      .endCell();
}

export class DomMaster implements Contract {
  constructor(
      readonly address: Address,
      readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(config: DomMasterConfig, code: Cell, workchain = 0) {
      const data = domMasterConfigToCell(config);
      const init = { code, data };
      return new DomMaster(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
      await provider.internal(via, { value });
  }

  async getJettonData(provider: ContractProvider) {
      const { stack } = await provider.get('getJettonData', []);
      return {
          totalSupply: stack.readBigNumber(),
          mintable: stack.readBigNumber(),
          minterAddress: stack.readAddress(),
          content: stack.readCell(),
          jettonWalletCode: stack.readCell(),
      };
  }

  async getWalletAddress(provider: ContractProvider, ownerAddress: Address) {
      const { stack } = await provider.get('getWalletAddress', [
          { type: 'slice', cell: beginCell().storeAddress(ownerAddress).endCell() },
      ]);
      return stack.readAddress();
  }

  async getMasterData(provider: ContractProvider) {
      const { stack } = await provider.get('getMasterData', []);
      return {
          minterAddress: stack.readAddress(),
          gasPoolAddress: stack.readAddress(),
      };
  }

  async getGiversData(provider: ContractProvider) {
      const { stack } = await provider.get('getGiversData', []);
      return {
          giverAllodiumAddress: stack.readAddress(),
          giverDefiAddress: stack.readAddress(),
          giverDaoAddress: stack.readAddress(),
          giverDominumAddress: stack.readAddress(),
      };
  }
}