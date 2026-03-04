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
  totalSuppl: bigint;
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
  const giverFirst = beginCell()
    .storeAddress(config.giverAllodiumAddress)
    .storeAddress(config.giverDefiAddress)
    .endCell();
  const giverSecond = beginCell()
    .storeAddress(config.giverDaoAddress)
    .storeAddress(config.giverDefiAddress)
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
    
  }
}