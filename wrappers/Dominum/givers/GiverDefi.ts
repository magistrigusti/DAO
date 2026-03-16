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

export type GiverDefiConfig = {
  managerAddress: Address;
  walletAddress?: Address | null;
  defiBankAddress: Address;
  defiDualAddress: Address;
};

export function giverDefiConfigToCell(
  config: GiverDefiConfig
): Cell {
  const targets = beginCell()
      .storeAddress(config.defiBankAddress)
      .storeAddress(config.defiDualAddress)
      .endCell();

  return beginCell()
      .storeAddress(config.managerAddress)
      .storeAddress(config.walletAddress ?? null)
      .storeRef(targets)
      .endCell();
}

export class GiverDefi implements Contract {
  constructor(
      readonly address: Address,
      readonly init?: { code: Cell; data: Cell }
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
          defiBankAddress: Address;
          defiDualAddress: Address;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_CHANGE_WHITELIST, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeAddress(opts.defiBankAddress)
          .storeAddress(opts.defiDualAddress)
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
          defiBankAddress: stack.readAddress(),
          defiDualAddress: stack.readAddress(),
      };
  }
}