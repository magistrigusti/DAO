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
  OP_ISSUE_BOND,
  OP_PAY_COUPON,
  OP_REDEEM_BOND,
} from '../core/op_code';

export type BankDaoConfig = {
  ownerAddress: Address;
  nftCollectionAddress: Address;
  totalBonds: bigint;
  totalLockedDom: bigint;
  totalLockedTon: bigint;
};

export function bankDaoConfigToCell(
  config: BankDaoConfig
): Cell {
  return beginCell()
      .storeAddress(config.ownerAddress)
      .storeAddress(config.nftCollectionAddress)
      .storeUint(config.totalBonds, 64)
      .storeCoins(config.totalLockedDom)
      .storeCoins(config.totalLockedTon)
      .endCell();
}

export class BankDao implements Contract {
  constructor(
      readonly address: Address,
      readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(
      config: BankDaoConfig,
      code: Cell,
      workchain = 0
  ) {
      const data = bankDaoConfigToCell(config);
      const init = { code, data };

      return new BankDao(
          contractAddress(workchain, init),
          init
      );
  }

  static createFromAddress(address: Address) {
      return new BankDao(address);
  }

  async sendDeploy(
      provider: ContractProvider,
      via: Sender,
      value: bigint
  ) {
      await provider.internal(via, { value });
  }

  async sendIssueBond(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          toAddress: Address;
          bondAmount: bigint;
          couponRate: number;
          maturityDate: bigint;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_ISSUE_BOND, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeAddress(opts.toAddress)
          .storeCoins(opts.bondAmount)
          .storeUint(opts.couponRate, 16)
          .storeUint(opts.maturityDate, 64)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  async sendPayCoupon(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          bondHolder: Address;
          couponAmount: bigint;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_PAY_COUPON, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeAddress(opts.bondHolder)
          .storeCoins(opts.couponAmount)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  async sendRedeemBond(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          bondHolder: Address;
          bondAmount: bigint;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_REDEEM_BOND, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeAddress(opts.bondHolder)
          .storeCoins(opts.bondAmount)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  async getBankData(provider: ContractProvider) {
      const { stack } = await provider.get(
          'getBankData',
          []
      );

      return {
          ownerAddress: stack.readAddress(),
          nftCollectionAddress: stack.readAddress(),
          totalBonds: stack.readBigNumber(),
          totalLockedDom: stack.readBigNumber(),
          totalLockedTon: stack.readBigNumber(),
      };
  }

  async getTotalLocked(provider: ContractProvider) {
      const { stack } = await provider.get(
          'getTotalLocked',
          []
      );

      return {
          totalLockedDom: stack.readBigNumber(),
          totalLockedTon: stack.readBigNumber(),
      };
  }
}