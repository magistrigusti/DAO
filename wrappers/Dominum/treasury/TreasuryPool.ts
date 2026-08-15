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
  TreasuryPoolConfig,
  treasuryPoolConfigToCell,
} from './TreasuryPoolConfig';
import {
  buildTreasuryAddressRequestBody,
  buildTreasuryAmountBody,
  buildTreasuryCancelBody,
  buildTreasuryConfirmBody,
  buildTreasuryExecuteBody,
  buildTreasuryInitMasterBody,
  buildTreasuryRetryBody,
  buildTreasuryTaxRequestBody,
  buildTreasuryWalletConfigBody,
  buildTreasuryWithdrawBody,
} from './TreasuryPoolMessages';

export {
  TreasuryPoolConfig,
  treasuryPoolConfigToCell,
} from './TreasuryPoolConfig';
export * from './TreasuryPoolMessages';

type SendOptions = { value: bigint; body: Cell };

export class TreasuryPool implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(
    config: TreasuryPoolConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = treasuryPoolConfigToCell(config);
    const init = { code, data };
    return new TreasuryPool(contractAddress(workchain, init), init);
  }

  static createFromAddress(address: Address) {
    return new TreasuryPool(address);
  }

  private async sendBody(
    provider: ContractProvider,
    via: Sender,
    opts: SendOptions
  ) {
    await provider.internal(via, opts);
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
    opts: Parameters<typeof buildTreasuryInitMasterBody>[0] & {
      value: bigint;
    }
  ) {
    await this.sendBody(provider, via, {
      value: opts.value,
      body: buildTreasuryInitMasterBody(opts),
    });
  }

  async sendInitTreasuryWalletConfig(
    provider: ContractProvider,
    via: Sender,
    opts: Parameters<typeof buildTreasuryWalletConfigBody>[0] & {
      value: bigint;
    }
  ) {
    await this.sendBody(provider, via, {
      value: opts.value,
      body: buildTreasuryWalletConfigBody(opts),
    });
  }

  async sendReplaceAddressRequest(
    provider: ContractProvider,
    via: Sender,
    opts: Parameters<typeof buildTreasuryAddressRequestBody>[0] & {
      value: bigint;
    }
  ) {
    await this.sendBody(provider, via, {
      value: opts.value,
      body: buildTreasuryAddressRequestBody(opts),
    });
  }

  async sendTaxRequest(
    provider: ContractProvider,
    via: Sender,
    opts: Parameters<typeof buildTreasuryTaxRequestBody>[0] & {
      value: bigint;
    }
  ) {
    await this.sendBody(provider, via, {
      value: opts.value,
      body: buildTreasuryTaxRequestBody(opts),
    });
  }

  async sendConfirmRequest(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; queryId?: bigint }
  ) {
    await this.sendBody(provider, via, {
      value: opts.value,
      body: buildTreasuryConfirmBody(opts.queryId),
    });
  }

  async sendCancelRequest(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; queryId?: bigint }
  ) {
    await this.sendBody(provider, via, {
      value: opts.value,
      body: buildTreasuryCancelBody(opts.queryId),
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
    await this.sendBody(provider, via, {
      value: opts.value,
      body: buildTreasuryWithdrawBody(opts),
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
    await this.sendBody(provider, via, {
      value: opts.value,
      body: buildTreasuryWithdrawBody({ ...opts, jettons: true }),
    });
  }

  async sendRefillPool(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; amount: bigint; queryId?: bigint }
  ) {
    await this.sendBody(provider, via, {
      value: opts.value,
      body: buildTreasuryAmountBody(opts),
    });
  }

  async sendWithdrawFromPool(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; amount: bigint; queryId?: bigint }
  ) {
    await this.sendBody(provider, via, {
      value: opts.value,
      body: buildTreasuryAmountBody({ ...opts, withdraw: true }),
    });
  }

  async sendTreasuryExecute(
    provider: ContractProvider,
    via: Sender,
    opts: Parameters<typeof buildTreasuryExecuteBody>[0] & {
      value: bigint;
    }
  ) {
    await this.sendBody(provider, via, {
      value: opts.value,
      body: buildTreasuryExecuteBody(opts),
    });
  }

  async sendRetryRoute(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; routeId: bigint }
  ) {
    await this.sendBody(provider, via, {
      value: opts.value,
      body: buildTreasuryRetryBody(opts.routeId),
    });
  }

  async sendRaw(
    provider: ContractProvider,
    via: Sender,
    opts: SendOptions
  ) {
    await this.sendBody(provider, via, opts);
  }

  async getTreasuryPoolData(provider: ContractProvider) {
    const { stack } = await provider.get('getTreasuryPoolData', []);
    return {
      ownerAddress: stack.readAddress(),
      treasuryManagerAddress: stack.readAddress(),
      jettonWalletAddress: stack.readAddress(),
      walletConfigured: stack.readBoolean(),
      bankDaoAddress: stack.readAddress(),
      bankDefiAddress: stack.readAddress(),
      bankDominumAddress: stack.readAddress(),
      gasPoolAddress: stack.readAddress(),
      taxMultiplier: stack.readBigNumber(),
      totalReceivedDom: stack.readBigNumber(),
      totalSentDom: stack.readBigNumber(),
      totalSentTon: stack.readBigNumber(),
      nextRouteId: stack.readBigNumber(),
    };
  }

  async getTreasuryPendingData(provider: ContractProvider) {
    const { stack } = await provider.get('getTreasuryPendingData', []);
    return {
      hasPending: stack.readBoolean(),
      pendingKind: stack.readBigNumber(),
      pendingTargetKind: stack.readBigNumber(),
      pendingOldAddress: stack.readAddressOpt(),
      pendingNewAddress: stack.readAddressOpt(),
      pendingOldValue: stack.readBigNumber(),
      pendingNewValue: stack.readBigNumber(),
    };
  }

  async isTreasuryTargetAllowed(
    provider: ContractProvider,
    candidate: Address
  ) {
    const { stack } = await provider.get('isTreasuryTargetAllowed', [
      {
        type: 'slice',
        cell: beginCell().storeAddress(candidate).endCell(),
      },
    ]);
    return stack.readBoolean();
  }

  async getRoute(provider: ContractProvider, routeId: bigint) {
    const { stack } = await provider.get('getTreasuryRoute', [
      { type: 'int', value: routeId },
    ]);
    return {
      sourceWallet: stack.readAddressOpt(),
      sourceQueryId: stack.readBigNumber(),
      fromOwner: stack.readAddressOpt(),
      toOwner: stack.readAddressOpt(),
      amount: stack.readBigNumber(),
      fee: stack.readBigNumber(),
      state: stack.readBigNumber(),
      ackMask: stack.readBigNumber(),
      success: stack.readBoolean(),
      found: stack.readBoolean(),
    };
  }
}
