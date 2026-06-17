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
  OP_ALLOD_GAS_POOL_EXECUTE,
  OP_ALLOD_GAS_TOP_UP,
  OP_CHANGE_ALLOD_TRANSFER_FEE,
  OP_INIT_ALLOD_MASTER_CONFIG,
} from '../core/op_code';

export type AllodGasPoolConfig = {
  authorityAddress: Address;
  masterAddress: Address;
  jettonWalletCode: Cell;
  masterConfigured?: boolean;
  transferFeeAllod: bigint;
  totalReceivedAllod?: bigint;
  totalSpentTon?: bigint;
  totalExecuted?: bigint;
};

export function allodGasPoolConfigToCell(
  config: AllodGasPoolConfig
): Cell {
  return beginCell()
    .storeAddress(config.authorityAddress)
    .storeAddress(config.masterAddress)
    .storeRef(config.jettonWalletCode)
    .storeBit(config.masterConfigured ?? false)
    .storeCoins(config.transferFeeAllod)
    .storeCoins(config.totalReceivedAllod ?? 0n)
    .storeCoins(config.totalSpentTon ?? 0n)
    .storeUint(config.totalExecuted ?? 0n, 64)
    .endCell();
}

export class AllodGasPool implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(
    config: AllodGasPoolConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = allodGasPoolConfigToCell(config);
    const init = { code, data };

    return new AllodGasPool(
      contractAddress(workchain, init),
      init
    );
  }

  static createFromAddress(address: Address) {
    return new AllodGasPool(address);
  }

  async sendDeploy(
    provider: ContractProvider,
    via: Sender,
    value: bigint
  ) {
    await provider.internal(via, { value });
  }

  async sendInitMasterConfig(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      masterAddress: Address;
      jettonWalletCode: Cell;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_INIT_ALLOD_MASTER_CONFIG, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeAddress(opts.masterAddress)
      .storeRef(opts.jettonWalletCode)
      .endCell();

    await provider.internal(via, {
      value: opts.value,
      body,
    });
  }

  async sendAllodGasPoolExecute(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      jettonAmount: bigint;
      toOwner: Address;
      fromOwner: Address;
      paidFeeAllod: bigint;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_ALLOD_GAS_POOL_EXECUTE, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.jettonAmount)
      .storeAddress(opts.toOwner)
      .storeAddress(opts.fromOwner)
      .storeCoins(opts.paidFeeAllod)
      .endCell();

    await provider.internal(via, {
      value: opts.value,
      body,
    });
  }

  async sendChangeTransferFee(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      newTransferFeeAllod: bigint;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_CHANGE_ALLOD_TRANSFER_FEE, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.newTransferFeeAllod)
      .endCell();

    await provider.internal(via, {
      value: opts.value,
      body,
    });
  }

  async sendTopUp(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_ALLOD_GAS_TOP_UP, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .endCell();

    await provider.internal(via, {
      value: opts.value,
      body,
    });
  }

  async getAllodGasPoolData(provider: ContractProvider) {
    const { stack } = await provider.get(
      'getAllodGasPoolData',
      []
    );

    return {
      authorityAddress: stack.readAddress(),
      masterAddress: stack.readAddress(),
      masterConfigured: stack.readBoolean(),
      transferFeeAllod: stack.readBigNumber(),
      totalReceivedAllod: stack.readBigNumber(),
      totalSpentTon: stack.readBigNumber(),
      totalExecuted: stack.readBigNumber(),
      tonBalance: stack.readBigNumber(),
    };
  }

  async getPoolWalletAddress(provider: ContractProvider) {
    const { stack } = await provider.get(
      'getPoolWalletAddress',
      []
    );

    return stack.readAddress();
  }

  async getWalletAddress(
    provider: ContractProvider,
    ownerAddress: Address
  ) {
    const { stack } = await provider.get(
      'getWalletAddress',
      [
        {
          type: 'slice',
          cell: beginCell()
            .storeAddress(ownerAddress)
            .endCell(),
        },
      ]
    );

    return stack.readAddress();
  }

  async getAllodTransferFee(provider: ContractProvider) {
    const { stack } = await provider.get(
      'getAllodTransferFee',
      []
    );

    return stack.readBigNumber();
  }
}