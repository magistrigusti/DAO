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

export type GiverAllodiumConfig = {
  managerAddress: Address;
  walletAddress?: Address | null;
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
      .storeAddress(config.managerAddress)
      .storeAddress(config.walletAddress ?? null)
      .storeRef(targets)
      .endCell();
}

export class GiverAllodium implements Contract {
  constructor(
      readonly address: Address,
      readonly init?: { code: Cell; data: Cell }
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

  async sendSetWallet(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          walletAddress: Address;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_SET_WALLET, 32)
          .storeUint(opts.queryId ?? 0n, 64)
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
          frsAllodiumAddress: Address;
          allodiumFoundationAddress: Address;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_CHANGE_WHITELIST, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeAddress(opts.frsAllodiumAddress)
          .storeAddress(opts.allodiumFoundationAddress)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  async getGiverData(provider: ContractProvider) {
      const { stack } = await provider.get(
          'getGiverData',
          []
      );

      return {
          managerAddress: stack.readAddress(),
          walletAddress: stack.readAddressOpt(),
          frsAllodiumAddress: stack.readAddress(),
          allodiumFoundationAddress: stack.readAddress(),
      };
  }
}