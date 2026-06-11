import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
} from '@ton/core';

export type AllodiumFoundationConfig = {
  ownerAddress: Address;
  domWalletAddress: Address;
  allodiumDaoAddress: Address;
  allodiumReserveAddress: Address;
  totalReceived?: bigint;
  totalSent?: bigint;
};

export function allodiumFoundationConfigToCell(
  config: AllodiumFoundationConfig
): Cell {
  return beginCell()
    .storeAddress(config.ownerAddress)
    .storeAddress(config.domWalletAddress)
    .storeAddress(config.allodiumDaoAddress)
    .storeAddress(config.allodiumReserveAddress)
    .storeCoins(config.totalReceived ?? 0n)
    .storeCoins(config.totalSent ?? 0n)
    .endCell();
}

export class AllodiumFoundation implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(
    config: AllodiumFoundationConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = allodiumFoundationConfigToCell(config);
    const init = { code, data };

    return new AllodiumFoundation(
      contractAddress(workchain, init),
      init
    );
  }

  static createFromAddress(address: Address) {
    return new AllodiumFoundation(address);
  }

  async sendDeploy(
    provider: ContractProvider,
    via: Sender,
    value: bigint
  ) {
    await provider.internal(via, { value });
  }

  async sendDomTransferNotification(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      amount: bigint;
      fromAddress: Address;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_TRANSFER_NOTIFICATION, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.amount)
      .storeAddress(opts.fromAddress)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
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

    await provider.internal(via, { value: opts.value, body });
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

    await provider.internal(via, { value: opts.value, body });
  }

  async getFoundationData(provider: ContractProvider) {
    const { stack } = await provider.get('getFoundationData', []);

    return {
      ownerAddress: stack.readAddress(),
      domWalletAddress: stack.readAddress(),
      allodiumDaoAddress: stack.readAddress(),
      allodiumReserveAddress: stack.readAddress(),
      totalReceived: stack.readBigNumber(),
      totalSent: stack.readBigNumber(),
    };
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