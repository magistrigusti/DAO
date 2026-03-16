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

export type GiverDominumConfig = {
  managerAddress: Address;
  walletAddress?: Address | null;
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
      .storeAddress(config.managerAddress)
      .storeAddress(config.walletAddress ?? null)
      .storeRef(targets)
      .endCell();
}

export class GiverDominum implements Contract {
  constructor(
      readonly address: Address,
      readonly init?: { code: Cell; data: Cell }
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
          bankDominumAddress: Address;
          dominumFoundationAddress: Address;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_CHANGE_WHITELIST, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeAddress(opts.bankDominumAddress)
          .storeAddress(opts.dominumFoundationAddress)
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
          bankDominumAddress: stack.readAddress(),
          dominumFoundationAddress: stack.readAddress(),
      };
  }
}