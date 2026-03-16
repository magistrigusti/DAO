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
  OP_CHANGE_TREASURY,
  OP_GAS_POOL_EXECUTE,
  OP_SET_RESERVE,
  OP_TOP_UP,
  OP_WITHDRAW_DOM,
  OP_WITHDRAW_TON,
} from '../core/op_code';

function readAddressOrNull(read: () => Address): Address | null {
  try {
      return read();
  } catch {
      return null;
  }
}

export type GasPoolConfig = {
  adminAddress: Address;
  proxyAddress: Address;
  domTreasuryAddress: Address;
  domBalance: bigint;
  tonReserve: bigint;
  hasPendingTreasury?: boolean;
  pendingTreasuryAddress?: Address | null;
  pendingTreasuryTime?: bigint;
};

export function gasPoolConfigToCell(
  config: GasPoolConfig
): Cell {
  const hasPendingTreasury =
      config.hasPendingTreasury ?? false;

  let builder = beginCell()
      .storeAddress(config.adminAddress)
      .storeAddress(config.proxyAddress)
      .storeAddress(config.domTreasuryAddress)
      .storeCoins(config.domBalance)
      .storeCoins(config.tonReserve)
      .storeBit(hasPendingTreasury);

  if (hasPendingTreasury) {
      if (!config.pendingTreasuryAddress) {
          throw new Error(
              'GasPool: pendingTreasuryAddress is required when hasPendingTreasury = true'
          );
      }

      builder = builder
          .storeAddress(config.pendingTreasuryAddress)
          .storeUint(
              config.pendingTreasuryTime ?? 0n,
              64
          );
  }

  return builder.endCell();
}

export class GasPool implements Contract {
  constructor(
      readonly address: Address,
      readonly init?: {
          code: Cell;
          data: Cell;
      }
  ) {}

  static createFromConfig(
      config: GasPoolConfig,
      code: Cell,
      workchain = 0
  ) {
      const data = gasPoolConfigToCell(config);
      const init = { code, data };

      return new GasPool(
          contractAddress(workchain, init),
          init
      );
  }

  static createFromAddress(address: Address) {
      return new GasPool(address);
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

  // ========== INTERNAL FLOW (обычно вызывает proxy) ==========
  async sendGasPoolExecute(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          jettonAmount: bigint;
          toOwner: Address;
          fromOwner: Address;
          treasuryFee: bigint;
          gasPoolFee: bigint;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_GAS_POOL_EXECUTE, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeCoins(opts.jettonAmount)
          .storeAddress(opts.toOwner)
          .storeAddress(opts.fromOwner)
          .storeCoins(opts.treasuryFee)
          .storeCoins(opts.gasPoolFee)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  // ========== ADMIN ==========
  async sendTopUp(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_TOP_UP, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  async sendWithdrawDom(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          amount: bigint;
          toOwner: Address;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_WITHDRAW_DOM, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeCoins(opts.amount)
          .storeAddress(opts.toOwner)
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
          .storeUint(OP_WITHDRAW_TON, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeCoins(opts.amount)
          .storeAddress(opts.toAddress)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  async sendSetReserve(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          reserveTonNano: bigint;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_SET_RESERVE, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeCoins(opts.reserveTonNano)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  async sendChangeTreasuryRequest(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          newTreasuryAddress: Address;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_CHANGE_TREASURY, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeUint(1, 8)
          .storeAddress(opts.newTreasuryAddress)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  async sendChangeTreasuryConfirm(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_CHANGE_TREASURY, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeUint(2, 8)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  async sendChangeTreasuryCancel(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          queryId?: bigint;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_CHANGE_TREASURY, 32)
          .storeUint(opts.queryId ?? 0n, 64)
          .storeUint(3, 8)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  // ========== GETTERS ==========
  async getPoolData(provider: ContractProvider) {
      const { stack } = await provider.get(
          'getPoolData',
          []
      );

      return {
          adminAddress: stack.readAddress(),
          proxyAddress: stack.readAddress(),
          domTreasuryAddress: stack.readAddress(),
          domBalance: stack.readBigNumber(),
          tonReserve: stack.readBigNumber(),
          availableTon: stack.readBigNumber(),
      };
  }

  async getPendingTreasury(
      provider: ContractProvider
  ) {
      const { stack } = await provider.get(
          'getPendingTreasury',
          []
      );

      const hasPendingTreasury = stack.readBoolean();
      const pendingTreasuryAddress = readAddressOrNull(() =>
          stack.readAddress()
      );
      const pendingTreasuryTime = stack.readBigNumber();

      return {
          hasPendingTreasury,
          pendingTreasuryAddress,
          pendingTreasuryTime,
      };
  }
}