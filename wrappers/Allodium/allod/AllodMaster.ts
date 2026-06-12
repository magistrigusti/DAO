import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
} from '@ton/core';
// wrappers/Allodium/allod/AllodMaster.ts

import {
    OP_INCREASE_MINT_ALLOWANCE,
    OP_MINT,
} from '../core/op_code';
export type AllodMasterConfig = {
  totalSupply: bigint;
  ownerAddress: Address;
  frsAddress: Address;
  foundationAddress: Address;
  mintAllowancePool: bigint;
  content: Cell;
  jettonWalletCode: Cell;
};

export function allodMasterConfigToCell(
  config: AllodMasterConfig
): Cell {
  return beginCell()
    .storeCoins(config.totalSupply)
    .storeAddress(config.ownerAddress)
    .storeAddress(config.frsAddress)
    .storeAddress(config.foundationAddress)
    .storeCoins(config.mintAllowancePool)
    .storeRef(config.content)
    .storeRef(config.jettonWalletCode)
    .endCell();
}

export class AllodMaster implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(
    config: AllodMasterConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = allodMasterConfigToCell(config);
    const init = { code, data };

    return new AllodMaster(
      contractAddress(workchain, init),
      init
    );
  }

  static createFromAddress(address: Address) {
    return new AllodMaster(address);
  }

  async sendDeploy(
    provider: ContractProvider,
    via: Sender,
    value: bigint
  ) {
    await provider.internal(via, { value });
  }

  async sendMint(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      toOwner: Address;
      amount: bigint;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_MINT, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeAddress(opts.toOwner)
      .storeCoins(opts.amount)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async sendIncreaseMintAllowance(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      amount: bigint;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_INCREASE_MINT_ALLOWANCE, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.amount)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async getJettonData(provider: ContractProvider) {
    const { stack } = await provider.get('getJettonData', []);

    return {
      totalSupply: stack.readBigNumber(),
      mintable: stack.readBigNumber(),
      ownerAddress: stack.readAddress(),
      content: stack.readCell(),
      jettonWalletCode: stack.readCell(),
    };
  }

  async getWalletAddress(
    provider: ContractProvider,
    ownerAddress: Address
  ) {
    const { stack } = await provider.get(
      'getWalletAddress',
      [
        {
          type: 'slice',
          cell: beginCell()
            .storeAddress(ownerAddress)
            .endCell(),
        },
      ]
    );

    return stack.readAddress();
  }

  async getMasterData(provider: ContractProvider) {
    const { stack } = await provider.get('getMasterData', []);

    return {
      ownerAddress: stack.readAddress(),
      frsAddress: stack.readAddress(),
      foundationAddress: stack.readAddress(),
      mintAllowancePool: stack.readBigNumber(),
      totalSupply: stack.readBigNumber(),
    };
  }
}