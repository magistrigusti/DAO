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
  OP_GAS_ROUTER_SET_CONTROLLER,
  OP_GAS_ROUTER_SET_POOL,
} from '../core/op_code';

export type GasRouterConfig = {
  controllerAddress: Address;
  controllerConfigured?: boolean;
  activeGasPoolAddress: Address;
};

export function gasRouterConfigToCell(
  config: GasRouterConfig
): Cell {
  return beginCell()
    .storeAddress(config.controllerAddress)
    .storeBit(config.controllerConfigured ?? false)
    .storeAddress(config.activeGasPoolAddress)
    .endCell();
}

export class GasRouter implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(
    config: GasRouterConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = gasRouterConfigToCell(config);
    const init = { code, data };

    return new GasRouter(contractAddress(workchain, init), init);
  }

  static createFromAddress(address: Address) {
    return new GasRouter(address);
  }

  async sendDeploy(
    provider: ContractProvider,
    via: Sender,
    value: bigint
  ) {
    await provider.internal(via, { value });
  }

  async sendSetController(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      controllerAddress: Address;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_GAS_ROUTER_SET_CONTROLLER, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeAddress(opts.controllerAddress)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async sendSetActiveGasPool(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      activeGasPoolAddress: Address;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_GAS_ROUTER_SET_POOL, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeAddress(opts.activeGasPoolAddress)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async getGasRouterData(provider: ContractProvider) {
    const { stack } = await provider.get('getGasRouterData', []);

    return {
      controllerAddress: stack.readAddress(),
      controllerConfigured: stack.readBoolean(),
      activeGasPoolAddress: stack.readAddress(),
    };
  }
}
