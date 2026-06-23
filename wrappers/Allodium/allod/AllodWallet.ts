import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
} from '@ton/core';
// wrappers/Allodium/allod/AllodWallet.ts

import {
    OP_BURN,
    OP_INTERNAL_TRANSFER,
    OP_PROTOCOL_TRANSFER,
    OP_TRANSFER,
} from '../core/op_code';

export type AllodWalletConfig = {
  balance: bigint;
  ownerAddress: Address;
  masterAddress: Address;
  gasPoolAddress: Address;
  jettonWalletCode: Cell;
};

export function allodWalletConfigToCell(
  config: AllodWalletConfig
): Cell {
  return beginCell()
    .storeCoins(config.balance)
    .storeAddress(config.ownerAddress)
    .storeAddress(config.masterAddress)
    .storeAddress(config.gasPoolAddress)
    .storeRef(config.jettonWalletCode)
    .endCell();
}

export class AllodWallet implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(
    config: AllodWalletConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = allodWalletConfigToCell(config);
    const init = { code, data };

    return new AllodWallet(contractAddress(workchain, init), init);
  }

  static createFromAddress(address: Address) {
    return new AllodWallet(address);
  }

  async sendDeploy(
    provider: ContractProvider,
    via: Sender,
    value: bigint
  ) {
    await provider.internal(via, { value });
  }

  async sendInternalTransfer(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      amount: bigint;
      fromOwner: Address;
      responseDestination?: Address | null;
      forwardTonAmount?: bigint;
      forwardPayload?: Cell | null;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_INTERNAL_TRANSFER, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.amount)
      .storeAddress(opts.fromOwner)
      .storeAddress(opts.responseDestination ?? null)
      .storeCoins(opts.forwardTonAmount ?? 0n);

    if (opts.forwardPayload) {
      body
        .storeBit(true)
        .storeRef(opts.forwardPayload);
    } else {
      body.storeBit(false);
    }

    await provider.internal(via, {
      value: opts.value,
      body: body.endCell(),
    });
  }

  async sendTransfer(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      amount: bigint;
      destination: Address;
      responseDestination?: Address | null;
      customPayload?: Cell | null;
      forwardTonAmount?: bigint;
      forwardPayload?: Cell | null;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_TRANSFER, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.amount)
      .storeAddress(opts.destination)
      .storeAddress(opts.responseDestination ?? null)
      .storeMaybeRef(opts.customPayload ?? null)
      .storeCoins(opts.forwardTonAmount ?? 0n);

    if (opts.forwardPayload) {
      body
        .storeBit(true)
        .storeRef(opts.forwardPayload);
    } else {
      body.storeBit(false);
    }

    await provider.internal(via, {
      value: opts.value,
      body: body.endCell(),
    });
  }

  async sendProtocolTransfer(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      amount: bigint;
      toOwner: Address;
      paidFeeAllod: bigint;
      responseDestination?: Address | null;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_PROTOCOL_TRANSFER, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.amount)
      .storeAddress(opts.toOwner)
      .storeAddress(opts.responseDestination ?? null)
      .storeCoins(opts.paidFeeAllod)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async sendBurn(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      amount: bigint;
      responseDestination?: Address | null;
      customPayload?: Cell | null;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_BURN, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.amount)
      .storeAddress(opts.responseDestination ?? null)
      .storeMaybeRef(opts.customPayload ?? null)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async getWalletData(provider: ContractProvider) {
    const { stack } = await provider.get('get_wallet_data', []);

    return {
      balance: stack.readBigNumber(),
      ownerAddress: stack.readAddress(),
      masterAddress: stack.readAddress(),
      jettonWalletCode: stack.readCell(),
    };
  }

  async getProtocolData(provider: ContractProvider) {
    const { stack } = await provider.get('get_protocol_data', []);

    return {
      gasPoolAddress: stack.readAddress(),
    };
  }

  async getPendingTransfer(
    provider: ContractProvider,
    queryId: bigint
  ) {
    const { stack } = await provider.get(
      'getPendingTransfer',
      [
        {
          type: 'int',
          value: queryId,
        },
      ]
    );

    return {
      totalSpend: stack.readBigNumber(),
      found: stack.readBoolean(),
    };
  }
}
