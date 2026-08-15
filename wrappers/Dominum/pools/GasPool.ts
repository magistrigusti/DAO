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
  GasPoolConfig,
  gasPoolConfigToCell,
} from './GasPoolConfig';
import {
  buildGasChangeTaxBody,
  buildGasCommitBody,
  buildGasExecuteBody,
  buildGasFinalizeBody,
  buildGasInitMasterBody,
  buildGasTopUpBody,
  buildGasWithdrawDomBody,
} from './GasPoolMessages';

export {
  GasPoolConfig,
  gasPoolConfigToCell,
} from './GasPoolConfig';
export * from './GasPoolMessages';

export class GasPool implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(
    config: GasPoolConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = gasPoolConfigToCell(config);
    const init = { code, data };
    return new GasPool(contractAddress(workchain, init), init);
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
    await provider.internal(via, {
      value: opts.value,
      body: buildGasInitMasterBody(opts),
    });
  }

  async sendGasPoolExecute(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      paidFeeDom: bigint;
      routeId?: bigint;
      queryId?: bigint;
    }
  ) {
    await provider.internal(via, {
      value: opts.value,
      body: buildGasExecuteBody(opts),
    });
  }

  async sendCommit(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; routeId: bigint }
  ) {
    await provider.internal(via, {
      value: opts.value,
      body: buildGasCommitBody(opts.routeId),
    });
  }

  async sendFinalize(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; routeId: bigint }
  ) {
    await provider.internal(via, {
      value: opts.value,
      body: buildGasFinalizeBody(opts.routeId),
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
    await provider.internal(via, {
      value: opts.value,
      body: buildGasChangeTaxBody(opts),
    });
  }

  async sendTopUp(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; queryId?: bigint }
  ) {
    await provider.internal(via, {
      value: opts.value,
      body: buildGasTopUpBody(opts.queryId),
    });
  }

  async sendWithdrawDom(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; amount: bigint; queryId?: bigint }
  ) {
    await provider.internal(via, {
      value: opts.value,
      body: buildGasWithdrawDomBody(opts),
    });
  }

  async getGasPoolData(provider: ContractProvider) {
    const { stack } = await provider.get('getGasPoolData', []);
    return {
      treasuryPoolAddress: stack.readAddress(),
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
    const { stack } = await provider.get('getPoolWalletAddress', []);
    return stack.readAddress();
  }

  async getWalletAddress(
    provider: ContractProvider,
    ownerAddress: Address
  ) {
    const { stack } = await provider.get('getWalletAddress', [
      {
        type: 'slice',
        cell: beginCell().storeAddress(ownerAddress).endCell(),
      },
    ]);
    return stack.readAddress();
  }

  async getDomTransferFee(provider: ContractProvider) {
    const { stack } = await provider.get('getDomTransferFee', []);
    return stack.readBigNumber();
  }

  async getExecution(
    provider: ContractProvider,
    routeId: bigint
  ) {
    const { stack } = await provider.get('getGasPoolExecution', [
      { type: 'int', value: routeId },
    ]);
    return {
      fee: stack.readBigNumber(),
      state: stack.readBigNumber(),
      found: stack.readBoolean(),
    };
  }
}
