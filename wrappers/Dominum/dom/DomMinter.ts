import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
} from '@ton/core';

const OP_MINT = 0x15;

export type DomMinterConfig = {
  adminAddress: Address;
  masterAddress: Address;
  lastMintTime: bigint;
  isStarted: boolean;
};

export function domMinterConfigToCell(config: DomMinterConfig): Cell {
  return beginCell()
      .storeAddress(config.adminAddress)
      .storeAddress(config.masterAddress)
      .storeUint(config.lastMintTime, 64)
      .storeBit(config.isStarted)
      .endCell();
}

export class DomMinter implements Contract {
  constructor(
      readonly address: Address,
      readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(config: DomMinterConfig, code: Cell, workchain = 0) {
      const data = domMinterConfigToCell(config);
      const init = { code, data };
      return new DomMinter(contractAddress(workchain, init), init);
  }

  async sendMint(
      provider: ContractProvider,
      via: Sender,
      opts: { value: bigint; amount?: bigint }
  ) {
      const body = beginCell()
          .storeUint(OP_MINT, 32)
          .storeUint(0, 64);
      if (opts.amount != null) {
          body.storeCoins(opts.amount);
      }
      await provider.internal(via, {
          value: opts.value,
          body: body.endCell(),
      });
  }

  async getMinterData(provider: ContractProvider) {
      const { stack } = await provider.get('getMinterData', []);
      return {
          adminAddress: stack.readAddress(),
          masterAddress: stack.readAddress(),
          lastMintTime: stack.readBigNumber(),
          nextMintTime: stack.readBigNumber(),
          isStarted: stack.readBoolean(),
          mintAmount: stack.readBigNumber(),
      };
  }
}