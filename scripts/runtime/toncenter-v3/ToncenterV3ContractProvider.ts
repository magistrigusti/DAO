import {
  Address,
  beginCell,
  Cell,
  comment,
  Contract,
  ContractProvider,
  ContractState,
  external,
  OpenedContract,
  openContract,
  Sender,
  StateInit,
  storeMessage,
  toNano,
  Transaction,
} from '@ton/core';

import { ToncenterV3Client } from './ToncenterV3Client';

function parseHashBuffer(value?: string): Buffer {
  if (!value) {
    return Buffer.alloc(0);
  }

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, 'hex');
  }

  return Buffer.from(value, 'base64');
}

export class ToncenterV3ContractProvider implements ContractProvider {
  constructor(
    private readonly client: ToncenterV3Client,
    private readonly address: Address,
    private readonly init: StateInit | null = null
  ) {}

  async getState(): Promise<ContractState> {
    const info = await this.client.getAddressInformation(this.address);

    const last =
      info.last_transaction_lt && info.last_transaction_hash
        ? {
            lt: BigInt(info.last_transaction_lt),
            hash: parseHashBuffer(info.last_transaction_hash),
          }
        : null;

    if (info.status === 'active') {
      return {
        balance: BigInt(info.balance),
        extracurrency: null,
        last,
        state: {
          type: 'active',
          code: info.code ? Buffer.from(info.code, 'base64') : null,
          data: info.data ? Buffer.from(info.data, 'base64') : null,
        },
      };
    }

    if (info.status === 'frozen') {
      return {
        balance: BigInt(info.balance),
        extracurrency: null,
        last,
        state: {
          type: 'frozen',
          stateHash: parseHashBuffer(info.frozen_hash),
        },
      };
    }

    return {
      balance: BigInt(info.balance),
      extracurrency: null,
      last,
      state: {
        type: 'uninit',
      },
    };
  }

  async get(name: string | number, args: any[]) {
    if (typeof name !== 'string') {
      throw new Error('Method name must be a string for Toncenter v3 provider');
    }

    const result = await this.client.runGetMethod(this.address, name, args);

    if (result.exitCode !== 0) {
      throw new Error(`runGetMethod ${name} failed with exitCode=${result.exitCode}`);
    }

    return {
      stack: result.stack,
      gasUsed: result.gasUsed,
    };
  }

  async external(message: Cell): Promise<void> {
    const neededInit = this.init && !(await this.client.isContractDeployed(this.address)) ? this.init : null;

    const ext = external({
      to: this.address,
      init: neededInit ?? undefined,
      body: message,
    });

    const boc = beginCell().store(storeMessage(ext)).endCell().toBoc();
    await this.client.sendMessage(boc);
  }

  async internal(
    via: Sender,
    args: {
      value: bigint | string;
      extracurrency?: any;
      bounce?: boolean | null;
      sendMode?: any;
      body?: Cell | string | null;
    }
  ): Promise<void> {
    const neededInit = this.init && !(await this.client.isContractDeployed(this.address)) ? this.init : null;
    const body = typeof args.body === 'string' ? comment(args.body) : args.body ?? undefined;
    const value = typeof args.value === 'string' ? toNano(args.value) : args.value;

    await via.send({
      to: this.address,
      value,
      bounce: args.bounce ?? true,
      sendMode: args.sendMode,
      extracurrency: args.extracurrency,
      init: neededInit ?? undefined,
      body,
    });
  }

  open<T extends Contract>(contract: T): OpenedContract<T> {
    return openContract(
      contract,
      ({ address, init }) => new ToncenterV3ContractProvider(this.client, address, init ?? null)
    );
  }

  async getTransactions(address: Address, _lt: bigint, _hash: Buffer, limit?: number): Promise<Transaction[]> {
    return (await this.client.getTransactions(address, limit ?? 100)) as Transaction[];
  }
}