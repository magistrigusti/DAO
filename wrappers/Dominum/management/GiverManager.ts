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
  OP_CHANGE_WHITELIST,
  OP_SET_WALLET,
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
      readonly init?: { code: Cell; data: Cell }
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

  async sendSetWallet(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          giverAddress: Address;
          walletAddress: Address;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_SET_WALLET, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeAddress(opts.giverAddress)
          .storeAddress(opts.walletAddress)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  async sendChangeWhitelist(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          giverAddress: Address;
          newAddress1: Address;
          newAddress2: Address;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_CHANGE_WHITELIST, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeAddress(opts.giverAddress)
          .storeAddress(opts.newAddress1)
          .storeAddress(opts.newAddress2)
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