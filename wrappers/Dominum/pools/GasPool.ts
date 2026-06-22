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
  OP_CHANGE_TAX,
  OP_GAS_POOL_EXECUTE,
  OP_INIT_MASTER_CONFIG,
  OP_TOP_UP,
  OP_WITHDRAW_DOM,
} from '../core/op_code';

export type GasPoolConfig = {
  treasuryPoolAddress: Address;
  gasRouterAddress: Address;
  masterAddress: Address;
  jettonWalletCode: Cell;
  masterConfigured?: boolean;
  taxMultiplier?: number;
  totalReceivedDom?: bigint;
  totalSpentTon?: bigint;
  totalExecuted?: bigint;
};

export function gasPoolConfigToCell(
  config: GasPoolConfig
): Cell {
  return beginCell()
    .storeAddress(config.treasuryPoolAddress)
    .storeAddress(config.gasRouterAddress)
    .storeAddress(config.masterAddress)
    .storeRef(config.jettonWalletCode)
    .storeBit(config.masterConfigured ?? false)
    .storeUint(config.taxMultiplier ?? 300, 16)
    .storeCoins(config.totalReceivedDom ?? 0n)
    .storeCoins(config.totalSpentTon ?? 0n)
    .storeUint(config.totalExecuted ?? 0n, 64)
    .endCell();
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
      .storeUint(OP_INIT_MASTER_CONFIG, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeAddress(opts.masterAddress)
      .storeRef(opts.jettonWalletCode)
      .endCell();

    await provider.internal(via, {
      value: opts.value,
      body,
    });
  }

  async sendGasPoolExecute(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      senderWalletAddress: Address;
      jettonAmount: bigint;
      toOwner: Address;
      fromOwner: Address;
      paidFeeDom?: bigint;
      maxFeeDom?: bigint;
      queryId?: bigint;
    }
  ) {
    const paidFeeDom = opts.paidFeeDom ?? opts.maxFeeDom;

    if (paidFeeDom === undefined) {
      throw new Error('paidFeeDom is required');
    }

    const body = beginCell()
      .storeUint(OP_GAS_POOL_EXECUTE, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeAddress(opts.senderWalletAddress)
      .storeCoins(opts.jettonAmount)
      .storeAddress(opts.toOwner)
      .storeAddress(opts.fromOwner)
      .storeCoins(paidFeeDom)
      .endCell();

    await provider.internal(via, {
      value: opts.value,
      body,
    });
  }

  async sendChangeTax(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      newTaxMultiplier: number;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_CHANGE_TAX, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeUint(opts.newTaxMultiplier, 16)
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
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_WITHDRAW_DOM, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.amount)
      .endCell();

    await provider.internal(via, {
      value: opts.value,
      body,
    });
  }

  async getGasPoolData(provider: ContractProvider) {
    const { stack } = await provider.get(
      'getGasPoolData',
      []
    );

    return {
      treasuryPoolAddress: stack.readAddress(),
      gasRouterAddress: stack.readAddress(),
      masterAddress: stack.readAddress(),
      masterConfigured: stack.readBoolean(),
      taxMultiplier: stack.readBigNumber(),
      totalReceivedDom: stack.readBigNumber(),
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

  async getDomTransferFee(provider: ContractProvider) {
    const { stack } = await provider.get(
      'getDomTransferFee',
      []
    );

    return stack.readBigNumber();
  }
}
