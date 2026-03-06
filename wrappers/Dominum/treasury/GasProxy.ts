import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
} from '@ton/core';

const OP_SET_PROXY_WALLET_CONFIG = 0xb4;

export type GasProxyConfig = {
  adminAddress: Address;
  realGasPoolAddress: Address;
  walletConfigReady: boolean;
  masterAddress?: Address;
  jettonWalletCode?: Cell;
  hasPending: boolean;
};

export function gasProxyConfigToCell(config: GasProxyConfig): Cell {
  let b = beginCell()
      .storeAddress(config.adminAddress)
      .storeAddress(config.realGasPoolAddress)
      .storeBit(config.walletConfigReady);
  if (config.walletConfigReady && config.masterAddress && config.jettonWalletCode) {
      b = b.storeAddress(config.masterAddress).storeRef(config.jettonWalletCode);
  }
  b = b.storeBit(config.hasPending);
  if (config.hasPending) {
      b = b.storeAddress(config.adminAddress).storeUint(0, 64);
  }
  return b.endCell();
}

export class GasProxy implements Contract {
  constructor(
      readonly address: Address,
      readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(config: GasProxyConfig, code: Cell, workchain = 0) {
      const data = gasProxyConfigToCell(config);
      const init = { code, data };
      return new GasProxy(contractAddress(workchain, init), init);
  }

  async sendSetWalletConfig(
      provider: ContractProvider,
      via: Sender,
      opts: { value: bigint; masterAddress: Address; jettonWalletCode: Cell }
  ) {
      const body = beginCell()
          .storeUint(OP_SET_PROXY_WALLET_CONFIG, 32)
          .storeUint(0, 64)
          .storeAddress(opts.masterAddress)
          .storeRef(opts.jettonWalletCode)
          .endCell();
      await provider.internal(via, { value: opts.value, body });
  }

  async getProxyData(provider: ContractProvider) {
      const { stack } = await provider.get('getProxyData', []);
      return {
          adminAddress: stack.readAddress(),
          realGasPoolAddress: stack.readAddress(),
          hasPending: stack.readBoolean(),
      };
  }
}