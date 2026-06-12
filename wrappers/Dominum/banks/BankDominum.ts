import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Dictionary,
  Sender,
} from '@ton/core';
import {
  OP_ADD_WHITELIST,
  OP_REFILL_POOL,
  OP_REMOVE_WHITELIST,
  OP_UPDATE_GAS_POOL,
  OP_WITHDRAW,
  OP_WITHDRAW_FROM_POOL,
  OP_WITHDRAW_JETTONS,
} from '../core/op_code';

export type BankDominumConfig = {
  ownerAddress: Address;
  gasPoolAddress: Address;
  domWalletAddress: Address;
  whitelistCount?: number;
  whitelistDict?: Dictionary<bigint, Cell> | null;
};

export function bankDominumConfigToCell(
  config: BankDominumConfig
): Cell {
  const whitelistDict =
      config.whitelistDict ??
      Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());

  return beginCell()
      .storeAddress(config.ownerAddress)
      .storeAddress(config.gasPoolAddress)
      .storeAddress(config.domWalletAddress)
      .storeUint(config.whitelistCount ?? 0, 16)
      .storeDict(whitelistDict)
      .endCell();
}

export class BankDominum implements Contract {
  constructor(
      readonly address: Address,
      readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(
      config: BankDominumConfig,
      code: Cell,
      workchain = 0
  ) {
      const data = bankDominumConfigToCell(config);
      const init = { code, data };

      return new BankDominum(
          contractAddress(workchain, init),
          init
      );
  }

  static createFromAddress(address: Address) {
      return new BankDominum(address);
  }

  async sendDeploy(
      provider: ContractProvider,
      via: Sender,
      value: bigint
  ) {
      await provider.internal(via, { value });
  }

  async sendUpdateGasPool(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          newGasPoolAddress: Address;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_UPDATE_GAS_POOL, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeAddress(opts.newGasPoolAddress)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
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

  async sendWithdrawFromPool(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          toAddress: Address;
          amount: bigint;
          queryId?: bigint;
      }
  ) {
      // ВАЖНО: порядок полей тут 1:1 как в bank_dominum.tolk
      const body = beginCell()
          .storeUint(OP_WITHDRAW_FROM_POOL, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeAddress(opts.toAddress)
          .storeCoins(opts.amount)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  async sendRefillPool(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          tonAmount: bigint;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_REFILL_POOL, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeCoins(opts.tonAmount)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  async sendAddWhitelist(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          address: Address;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_ADD_WHITELIST, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeAddress(opts.address)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  async sendRemoveWhitelist(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          address: Address;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_REMOVE_WHITELIST, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeAddress(opts.address)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  async getBankDominumData(
      provider: ContractProvider
  ) {
      const { stack } = await provider.get(
          'getBankDominumData',
          []
      );

      return {
          ownerAddress: stack.readAddress(),
          gasPoolAddress: stack.readAddress(),
          domWalletAddress: stack.readAddress(),
          whitelistCount: stack.readBigNumber(),
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

  async isAddressAllowed(
      provider: ContractProvider,
      candidate: Address
  ) {
      const { stack } = await provider.get(
          'isAddressAllowed',
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
