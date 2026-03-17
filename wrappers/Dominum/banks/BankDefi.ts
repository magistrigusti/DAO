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
  OP_WITHDRAW,
  OP_WITHDRAW_JETTONS,
} from '../core/op_code';

export type BankDefiConfig = {
  ownerAddress: Address;
  domWalletAddress: Address;
};

export function bankDefiConfigToCell(
  config: BankDefiConfig
): Cell {
  return beginCell()
      .storeAddress(config.ownerAddress)
      .storeAddress(config.domWalletAddress)
      .endCell();
}

export class BankDefi implements Contract {
  constructor(
      readonly address: Address,
      readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(
      config: BankDefiConfig,
      code: Cell,
      workchain = 0
  ) {
      const data = bankDefiConfigToCell(config);
      const init = { code, data };

      return new BankDefi(
          contractAddress(workchain, init),
          init
      );
  }

  static createFromAddress(address: Address) {
      return new BankDefi(address);
  }

  async sendDeploy(
      provider: ContractProvider,
      via: Sender,
      value: bigint
  ) {
      await provider.internal(via, { value });
  }

  async sendWithdrawTon(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          amount: bigint;
          toAddress: Address;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_WITHDRAW, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeCoins(opts.amount)
          .storeAddress(opts.toAddress)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  async sendWithdrawJettons(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          amount: bigint;
          toAddress: Address;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_WITHDRAW_JETTONS, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeCoins(opts.amount)
          .storeAddress(opts.toAddress)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  async getDefiBankData(provider: ContractProvider) {
      const { stack } = await provider.get(
          'getDefiBankData',
          []
      );

      return {
          ownerAddress: stack.readAddress(),
          domWalletAddress: stack.readAddress(),
          tonBalance: stack.readBigNumber(),
      };
  }
}