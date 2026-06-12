import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
} from '@ton/core';
// wrappers/Allodium/treasury/FrsAllodium.ts

import {
    OP_ALLOD_BURNED,
    OP_TRANSFER_NOTIFICATION,
} from '../core/op_code';

export type FrsAllodiumConfig = {
  ownerAddress: Address;
  domWalletAddress: Address;
  allodMasterAddress: Address;
  giverAllodiumAddress: Address;
  allodiumFoundationAddress: Address;
  lockedDom?: bigint;
};

export function frsAllodiumConfigToCell(
  config: FrsAllodiumConfig
): Cell {
  return beginCell()
    .storeAddress(config.ownerAddress)
    .storeAddress(config.domWalletAddress)
    .storeAddress(config.allodMasterAddress)
    .storeAddress(config.giverAllodiumAddress)
    .storeAddress(config.allodiumFoundationAddress)
    .storeCoins(config.lockedDom ?? 0n)
    .endCell();
}

export class FrsAllodium implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(
    config: FrsAllodiumConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = frsAllodiumConfigToCell(config);
    const init = { code, data };

    return new FrsAllodium(contractAddress(workchain, init), init);
  }

  static createFromAddress(address: Address) {
    return new FrsAllodium(address);
  }

  async sendDeploy(
    provider: ContractProvider,
    via: Sender,
    value: bigint
  ) {
    await provider.internal(via, { value });
  }

  async sendDomTransferNotification(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      amount: bigint;
      fromAddress: Address;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_TRANSFER_NOTIFICATION, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.amount)
      .storeAddress(opts.fromAddress)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async sendAllodBurned(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      amount: bigint;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_ALLOD_BURNED, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.amount)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async getFrsData(provider: ContractProvider) {
    const { stack } = await provider.get('getFrsData', []);

    return {
      ownerAddress: stack.readAddress(),
      domWalletAddress: stack.readAddress(),
      allodMasterAddress: stack.readAddress(),
      giverAllodiumAddress: stack.readAddress(),
      allodiumFoundationAddress: stack.readAddress(),
      lockedDom: stack.readBigNumber(),
    };
  }

  async getLockedDom(provider: ContractProvider) {
    const { stack } = await provider.get('getLockedDom', []);
    return stack.readBigNumber();
  }

  async getMaxAllod(provider: ContractProvider) {
    const { stack } = await provider.get('getMaxAllod', []);
    return stack.readBigNumber();
  }
}