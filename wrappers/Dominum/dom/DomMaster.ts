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
  OP_MINT,
  OP_CONFIRM_MASTER_REQUEST,
  OP_REJECT_MASTER_REQUEST,
  OP_REPLACE_GIVER,
  OP_REPLACE_MANAGER,
  OP_REPLACE_MINTER,
} from '../core/op_code';

export type DomMasterConfig = {
  totalSupply: bigint;
  ownerAddress: Address;
  lastMintTime: bigint;
  isStarted: boolean;
  gasRouterAddress: Address;
  minterAddress: Address;
  minterManagerAddress: Address;
  giverManagerAddress: Address;
  giverAllodiumAddress: Address;
  giverDefiAddress: Address;
  giverDaoAddress: Address;
  giverDominumAddress: Address;
  hasPendingMasterRequest?: boolean;
  pendingMasterRequestKind?: number;
  pendingMasterTargetKind?: number;
  pendingMasterOldAddress?: Address | null;
  pendingMasterNewAddress?: Address | null;
  content: Cell;
  jettonWalletCode: Cell;
};

export function domMasterConfigToCell(
  config: DomMasterConfig
): Cell {
  const roleCore = beginCell()
    .storeAddress(config.gasRouterAddress)
    .storeAddress(config.minterAddress)
    .endCell();

  const roleManagers = beginCell()
    .storeAddress(config.minterManagerAddress)
    .storeAddress(config.giverManagerAddress)
    .endCell();

  const roles = beginCell()
    .storeRef(roleCore)
    .storeRef(roleManagers)
    .endCell();

  const giversFirst = beginCell()
    .storeAddress(config.giverAllodiumAddress)
    .storeAddress(config.giverDefiAddress)
    .endCell();

  const giversSecond = beginCell()
    .storeAddress(config.giverDaoAddress)
    .storeAddress(config.giverDominumAddress)
    .endCell();

  const givers = beginCell()
    .storeRef(giversFirst)
    .storeRef(giversSecond)
    .endCell();

  const pending = beginCell()
    .storeBit(config.hasPendingMasterRequest ?? false)
    .storeUint(config.pendingMasterRequestKind ?? 0, 8)
    .storeUint(config.pendingMasterTargetKind ?? 0, 8)
    .storeAddress(config.pendingMasterOldAddress ?? null)
    .storeAddress(config.pendingMasterNewAddress ?? null)
    .endCell();

  const metadataAndCode = beginCell()
    .storeRef(config.content)
    .storeRef(config.jettonWalletCode)
    .endCell();

  return beginCell()
    .storeCoins(config.totalSupply)
    .storeAddress(config.ownerAddress)
    .storeUint(config.lastMintTime, 64)
    .storeBit(config.isStarted)
    .storeRef(roles)
    .storeRef(givers)
    .storeRef(pending)
    .storeRef(metadataAndCode)
    .endCell();
}

export class DomMaster implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: {
      code: Cell;
      data: Cell;
    }
  ) {}

  static createFromConfig(
    config: DomMasterConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = domMasterConfigToCell(config);
    const init = { code, data };

    return new DomMaster(
      contractAddress(workchain, init),
      init
    );
  }

  static createFromAddress(address: Address) {
    return new DomMaster(address);
  }

  async sendDeploy(
    provider: ContractProvider,
    via: Sender,
    value: bigint
  ) {
    await provider.internal(via, { value });
  }

  async sendMint(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      amount: bigint;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_MINT, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeCoins(opts.amount)
      .endCell();

    await provider.internal(via, {
      value: opts.value,
      body,
    });
  }

  async sendReplaceMinter(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      oldMinterAddress: Address;
      newMinterAddress: Address;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_REPLACE_MINTER, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeAddress(opts.oldMinterAddress)
      .storeAddress(opts.newMinterAddress)
      .endCell();

    await provider.internal(via, {
      value: opts.value,
      body,
    });
  }

  async sendReplaceGiver(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      targetKind: number;
      oldGiverAddress: Address;
      newGiverAddress: Address;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_REPLACE_GIVER, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeUint(opts.targetKind, 8)
      .storeAddress(opts.oldGiverAddress)
      .storeAddress(opts.newGiverAddress)
      .endCell();

    await provider.internal(via, {
      value: opts.value,
      body,
    });
  }

  async sendReplaceManager(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      targetKind: number;
      oldManagerAddress: Address;
      newManagerAddress: Address;
      queryId?: bigint;
    }
  ) {
    const body = beginCell()
      .storeUint(OP_REPLACE_MANAGER, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .storeUint(opts.targetKind, 8)
      .storeAddress(opts.oldManagerAddress)
      .storeAddress(opts.newManagerAddress)
      .endCell();

    await provider.internal(via, {
      value: opts.value,
      body,
    });
  }

  async sendConfirmMasterRequest(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; queryId?: bigint }
  ) {
    const body = beginCell()
      .storeUint(OP_CONFIRM_MASTER_REQUEST, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async sendRejectMasterRequest(
    provider: ContractProvider,
    via: Sender,
    opts: { value: bigint; queryId?: bigint }
  ) {
    const body = beginCell()
      .storeUint(OP_REJECT_MASTER_REQUEST, 32)
      .storeUint(opts.queryId ?? 0n, 64)
      .endCell();

    await provider.internal(via, { value: opts.value, body });
  }

  async getJettonData(provider: ContractProvider) {
    const { stack } = await provider.get(
      'getJettonData',
      []
    );

    return {
      totalSupply: stack.readBigNumber(),
      mintable: stack.readBigNumber(),
      ownerAddress: stack.readAddress(),
      content: stack.readCell(),
      jettonWalletCode: stack.readCell(),
    };
  }

  async getWalletAddress(
    provider: ContractProvider,
    ownerAddress: Address
  ) {
    const { stack } = await provider.get(
      'getWalletAddress',
      [
        {
          type: 'slice',
          cell: beginCell()
            .storeAddress(ownerAddress)
            .endCell(),
        },
      ]
    );

    return stack.readAddress();
  }

  async getMasterData(provider: ContractProvider) {
    const { stack } = await provider.get(
      'getMasterData',
      []
    );

    return {
      ownerAddress: stack.readAddress(),
      gasRouterAddress: stack.readAddress(),
      minterAddress: stack.readAddress(),
      minterManagerAddress: stack.readAddress(),
      giverManagerAddress: stack.readAddress(),
      lastMintTime: stack.readBigNumber(),
      nextMintTime: stack.readBigNumber(),
      isStarted: stack.readBoolean(),
    };
  }

  async getMasterPendingRequest(provider: ContractProvider) {
    const { stack } = await provider.get(
      'getMasterPendingRequest',
      []
    );

    return {
      hasPending: stack.readBoolean(),
      requestKind: stack.readBigNumber(),
      targetKind: stack.readBigNumber(),
      oldAddress: stack.readAddressOpt(),
      newAddress: stack.readAddressOpt(),
    };
  }

  async getMintRules(provider: ContractProvider) {
    const { stack } = await provider.get(
      'getMintRules',
      []
    );

    return {
      minMintAmount: stack.readBigNumber(),
      maxMintAmount: stack.readBigNumber(),
      mintInterval: stack.readBigNumber(),
    };
  }

  async canMintNow(provider: ContractProvider) {
    const { stack } = await provider.get(
      'canMintNow',
      []
    );

    return stack.readBoolean();
  }

  async getCanMintNow(provider: ContractProvider) {
    return this.canMintNow(provider);
  }

  async getGiversData(provider: ContractProvider) {
    const { stack } = await provider.get(
      'getGiversData',
      []
    );

    return {
      giverAllodiumAddress: stack.readAddress(),
      giverDefiAddress: stack.readAddress(),
      giverDaoAddress: stack.readAddress(),
      giverDominumAddress: stack.readAddress(),
    };
  }
}
