import {
  Address,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
} from '@ton/core';
import {
  DomWalletConfig,
  domWalletConfigToCell,
} from './DomWalletConfig';
import {
  buildClearPendingBody,
  buildDomBurnBody,
  buildDomInternalTransferBody,
  buildDomProtocolTransferBody,
  buildDomTransferBody,
  buildProtocolDeliveryBody,
  buildProtocolSourceResultBody,
  DomInternalTransferOptions,
  DomProtocolTransferOptions,
  DomTransferOptions,
} from './DomWalletMessages';

export {
  DomWalletConfig,
  domWalletConfigToCell,
} from './DomWalletConfig';
export * from './DomWalletMessages';

export class DomWallet implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(
    config: DomWalletConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = domWalletConfigToCell(config);
    const init = { code, data };
    return new DomWallet(contractAddress(workchain, init), init);
  }

  static createFromAddress(address: Address) {
    return new DomWallet(address);
  }

  async sendDeploy(
    provider: ContractProvider,
    via: Sender,
    value: bigint
  ) {
    await provider.internal(via, { value });
  }

  async sendTransfer(
    provider: ContractProvider,
    via: Sender,
    opts: DomTransferOptions & { value: bigint }
  ) {
    await provider.internal(via, {
      value: opts.value,
      body: buildDomTransferBody(opts),
    });
  }

  async sendProtocolTransfer(
    provider: ContractProvider,
    via: Sender,
    opts: DomProtocolTransferOptions & { value: bigint }
  ) {
    return provider.internal(via, {
      value: opts.value,
      body: buildDomProtocolTransferBody(opts),
    });
  }

  async sendInternalTransfer(
    provider: ContractProvider,
    via: Sender,
    opts: DomInternalTransferOptions & { value: bigint }
  ) {
    await provider.internal(via, {
      value: opts.value,
      body: buildDomInternalTransferBody(opts),
    });
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
    await provider.internal(via, {
      value: opts.value,
      body: buildDomBurnBody(opts),
    });
  }

  async sendClearPendingTransfer(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; queryId: bigint }
  ) {
    await provider.internal(via, {
      value: opts.value,
      body: buildClearPendingBody(opts.queryId),
    });
  }

  async sendProtocolDelivery(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      routeId: bigint;
      leg: number;
      amount: bigint;
      fromOwner: Address;
    }
  ) {
    await provider.internal(via, {
      value: opts.value,
      body: buildProtocolDeliveryBody(opts),
    });
  }

  async sendProtocolSourceResult(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      routeId: bigint;
      sourceQueryId: bigint;
      success: boolean;
    }
  ) {
    return provider.internal(via, {
      value: opts.value,
      body: buildProtocolSourceResultBody(opts),
    });
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
    return { treasuryPoolAddress: stack.readAddress() };
  }

  async getPendingTransfer(
    provider: ContractProvider,
    queryId: bigint
  ) {
    const { stack } = await provider.get('getPendingTransfer', [
      { type: 'int', value: queryId },
    ]);
    return {
      totalSpend: stack.readBigNumber(),
      found: stack.readBoolean(),
    };
  }

  async getProtocolReplayData(provider: ContractProvider) {
    const { stack } = await provider.get('getProtocolReplayData', []);
    return stack.readBigNumber();
  }

  async getProcessedDelivery(
    provider: ContractProvider,
    routeId: bigint,
    leg: number
  ) {
    const { stack } = await provider.get('getProcessedDelivery', [
      { type: 'int', value: routeId },
      { type: 'int', value: BigInt(leg) },
    ]);
    return {
      amount: stack.readBigNumber(),
      fromOwner: stack.readAddressOpt(),
      found: stack.readBoolean(),
    };
  }

  async getSourceReceipt(
    provider: ContractProvider,
    routeId: bigint
  ) {
    const { stack } = await provider.get('getSourceReceipt', [
      { type: 'int', value: routeId },
    ]);
    return {
      sourceQueryId: stack.readBigNumber(),
      success: stack.readBoolean(),
      found: stack.readBoolean(),
    };
  }
}
