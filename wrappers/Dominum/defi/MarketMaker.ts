import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
} from '@ton/core';
import { OP_WITHDRAW, OP_WITHDRAW_JETTONS } from '../core/op_code';

export type MarketMakerConfig = {
  ownerAddress: Address;
  walletAddress: Address;
  defiBankAddress: Address;
  defiFoundationAddress: Address;
  totalReceived?: bigint;
  totalSent?: bigint;
};

export function marketMakerConfigToCell(config: MarketMakerConfig): Cell {
  const targets = beginCell()
    .storeAddress(config.defiBankAddress)
    .storeAddress(config.defiFoundationAddress)
    .endCell();

  return beginCell()
    .storeAddress(config.ownerAddress)
    .storeAddress(config.walletAddress)
    .storeRef(targets)
    .storeCoins(config.totalReceived ?? 0n)
    .storeCoins(config.totalSent ?? 0n)
    .endCell();
}

export class MarketMaker implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromConfig(config: MarketMakerConfig, code: Cell, workchain = 0) {
    const data = marketMakerConfigToCell(config);
    const init = { code, data };

    return new MarketMaker(contractAddress(workchain, init), init);
  }

  static createFromAddress(address: Address) {
    return new MarketMaker(address);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, { value });
  }

  async sendWithdrawTon(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; amount: bigint; toAddress: Address; queryId?: bigint }
  ) {
    const body = beginCell()
      .storeUint(OP_WITHDRAW, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.amount)
      .storeAddress(opts.toAddress)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async sendWithdrawJettons(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; amount: bigint; toAddress: Address; queryId?: bigint }
  ) {
    const body = beginCell()
      .storeUint(OP_WITHDRAW_JETTONS, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.amount)
      .storeAddress(opts.toAddress)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async getMarketData(provider: ContractProvider) {
    const { stack } = await provider.get('getMarketData', []);

    return {
      ownerAddress: stack.readAddress(),
      walletAddress: stack.readAddress(),
      defiBankAddress: stack.readAddress(),
      defiFoundationAddress: stack.readAddress(),
      totalReceived: stack.readBigNumber(),
      totalSent: stack.readBigNumber(),
    };
  }

  async isAddressAllowed(provider: ContractProvider, candidate: Address) {
    const { stack } = await provider.get('isAddressAllowed', [
      { type: 'slice', cell: beginCell().storeAddress(candidate).endCell() },
    ]);

    return stack.readBoolean();
  }
}