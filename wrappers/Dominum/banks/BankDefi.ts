import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Dictionary,
  Sender,
} from '@ton/core';
import {
  OP_ADD_WHITELIST,
  OP_REMOVE_WHITELIST,
  OP_WITHDRAW,
  OP_WITHDRAW_JETTONS,
} from '../core/op_code';

export type BankDefiConfig = {
  ownerAddress: Address;
  walletAddress: Address;
  defiFoundationAddress: Address;
  marketMakerAddress: Address;
  whitelistCount?: number;
  totalReceived?: bigint;
  totalSent?: bigint;
  whitelistDict?: Dictionary<bigint, Cell> | null;
};

export function bankDefiConfigToCell(config: BankDefiConfig): Cell {
  const whitelistDict =
    config.whitelistDict ??
    Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());

  const targets = beginCell()
    .storeAddress(config.defiFoundationAddress)
    .storeAddress(config.marketMakerAddress)
    .storeUint(config.whitelistCount ?? 0, 16)
    .endCell();

  const statsRef = beginCell()
    .storeCoins(config.totalReceived ?? 0n)
    .storeCoins(config.totalSent ?? 0n)
    .storeDict(whitelistDict)
    .endCell();

  return beginCell()
    .storeAddress(config.ownerAddress)
    .storeAddress(config.walletAddress)
    .storeRef(targets)
    .storeRef(statsRef)
    .endCell();
}

export class BankDefi implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromConfig(config: BankDefiConfig, code: Cell, workchain = 0) {
    const data = bankDefiConfigToCell(config);
    const init = { code, data };
    return new BankDefi(contractAddress(workchain, init), init);
  }

  static createFromAddress(address: Address) {
    return new BankDefi(address);
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

  async sendAddWhitelist(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; address: Address; queryId?: bigint }
  ) {
    const body = beginCell()
      .storeUint(OP_ADD_WHITELIST, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeAddress(opts.address)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async sendRemoveWhitelist(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; address: Address; queryId?: bigint }
  ) {
    const body = beginCell()
      .storeUint(OP_REMOVE_WHITELIST, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeAddress(opts.address)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async getDefiBankData(provider: ContractProvider) {
    const { stack } = await provider.get('getDefiBankData', []);

    return {
      ownerAddress: stack.readAddress(),
      walletAddress: stack.readAddress(),
      defiFoundationAddress: stack.readAddress(),
      marketMakerAddress: stack.readAddress(),
      whitelistCount: stack.readBigNumber(),
      totalReceived: stack.readBigNumber(),
      totalSent: stack.readBigNumber(),
    };
  }

  async isAddressWhitelisted(provider: ContractProvider, candidate: Address) {
    const { stack } = await provider.get('isAddressWhitelisted', [
      { type: 'slice', cell: beginCell().storeAddress(candidate).endCell() },
    ]);

    return stack.readBoolean();
  }

  async isAddressAllowed(provider: ContractProvider, candidate: Address) {
    const { stack } = await provider.get('isAddressAllowed', [
      { type: 'slice', cell: beginCell().storeAddress(candidate).endCell() },
    ]);

    return stack.readBoolean();
  }
}
