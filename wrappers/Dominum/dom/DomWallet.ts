import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
} from '@ton/core';

const OP_TRANSFER = 0xf8a7ea5n;

export type DomWalletConfig = {
  balance: bigint;
  ownerAddress: Address;
  masterAddress: Address;
  gasPoolAddress: Address;
  jettonWalletCode: Cell;
};

export function domWalletConfigToCell(config: DomWalletConfig): Cell {
  return beginCell()
      .storeCoins(config.balance)
      .storeAddress(config.ownerAddress)
      .storeAddress(config.masterAddress)
      .storeAddress(config.gasPoolAddress)
      .storeRef(config.jettonWalletCode)
      .endCell();
}

export class DomWallet implements Contract {
  constructor(
      readonly address: Address,
      readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(config: DomWalletConfig, code: Cell, workchain = 0) {
      const data = domWalletConfigToCell(config);
      const init = { code, data };
      return new DomWallet(contractAddress(workchain, init), init);
  }

  async sendTransfer(
      provider: ContractProvider,
      via: Sender,
      opts: {
          value: bigint;
          jettonAmount: bigint;
          toOwner: Address;
          responseDestination?: Address;
      }
  ) {
      const body = beginCell()
          .storeUint(OP_TRANSFER, 32)
          .storeUint(0, 64)
          .storeCoins(opts.jettonAmount)
          .storeAddress(opts.toOwner)
          .storeAddress(opts.responseDestination ?? opts.toOwner)
          .storeBool(false)
          .storeCoins(0)
          .storeBool(false)
          .endCell();

      await provider.internal(via, {
          value: opts.value,
          body,
      });
  }

  async getWalletData(provider: ContractProvider) {
      const { stack } = await provider.get('getWalletData', []);
      return {
          balance: stack.readBigNumber(),
          ownerAddress: stack.readAddress(),
          masterAddress: stack.readAddress(),
          gasPoolAddress: stack.readAddress(),
      };
  }
}