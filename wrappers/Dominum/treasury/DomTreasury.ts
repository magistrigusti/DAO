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

export type DomTreasuryConfig = {
  ownerAddress: Address;
  jettonWalletAddress: Address;
  bankDaoAddress: Address;
  bankDefiAddress: Address;
  bankDominumAddress: Address;
};

export function domTreasuryConfigToCell(
  config: DomTreasuryConfig
): Cell {
  return beginCell()
      .storeAddress(config.ownerAddress)
      .storeAddress(config.jettonWalletAddress)
      .storeAddress(config.bankDaoAddress)
      .storeAddress(config.bankDefiAddress)
      .storeAddress(config.bankDominumAddress)
      .endCell();
}

export class DomTreasury implements Contract {
  constructor(
      readonly address: Address,
      readonly init?: {
          code: Cell;
          data: Cell;
      }
  ) {}

  static createFromConfig(
      config: DomTreasuryConfig,
      code: Cell,
      workchain = 0
  ) {
      const data = domTreasuryConfigToCell(config);
      const init = { code, data };

      return new DomTreasury(
          contractAddress(workchain, init),
          init
      );
  }

  static createFromAddress(address: Address) {
      return new DomTreasury(address);
  }

  async sendDeploy(
      provider: ContractProvider,
      via: Sender,
      value: bigint
  ) {
      await provider.internal(via, {
          value,
      });
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

  async getTreasuryData(
      provider: ContractProvider
  ) {
      const { stack } = await provider.get(
          'getTreasuryData',
          []
      );

      return {
          ownerAddress: stack.readAddress(),
          jettonWalletAddress: stack.readAddress(),
          bankDaoAddress: stack.readAddress(),
          bankDefiAddress: stack.readAddress(),
          bankDominumAddress: stack.readAddress(),
          tonBalance: stack.readBigNumber(),
      };
  }

  async isAddressWhitelisted(
      provider: ContractProvider,
      candidate: Address
  ) {
      const { stack } = await provider.get(
          'isAddressWhitelisted',
          [
              {
                  type: 'slice',
                  cell: beginCell()
                      .storeAddress(candidate)
                      .endCell(),
              },
          ]
      );

      return stack.readBoolean();
  }
}