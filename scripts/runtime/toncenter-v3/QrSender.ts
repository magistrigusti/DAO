import path from 'path';

import {
  Address,
  SendMode,
  SenderArguments,
} from '@ton/core';
import {
  SenderWithSendResult,
  UIProvider,
} from '@ton/blueprint';
import type { Network } from '@ton/blueprint/dist/network/Network';
import { TonConnectProvider } from '@ton/blueprint/dist/network/send/TonConnectProvider';
import { FSStorage } from '@ton/blueprint/dist/network/storage/FSStorage';

import { ToncenterV3Client } from './ToncenterV3Client';

export type QrSendMarker = {
  kind: 'tonconnect';
  walletAddress: string;
  beforeLt: string | null;
  sentAt: number;
  result: unknown;
};

type CreateQrSenderParams = {
  client: ToncenterV3Client;
  ui: UIProvider;
  network: Network;
  sessionPath?: string;
  manifestUrl?: string;
};

export class QrSender implements SenderWithSendResult {
  private _lastSendResult?: QrSendMarker;
  private readonly provider: TonConnectProvider;

  private constructor(
    private readonly client: ToncenterV3Client,
    provider: TonConnectProvider
  ) {
    this.provider = provider;
  }

  static async create(params: CreateQrSenderParams): Promise<QrSender> {
    const sessionPath =
      params.sessionPath
      ?? path.join(process.cwd(), '.tonconnect', `${params.network}.json`);

    const provider = new TonConnectProvider(
      new FSStorage(sessionPath),
      params.ui,
      params.network,
      params.manifestUrl
    );

    await provider.connect();

    return new QrSender(params.client, provider);
  }

  get address(): Address | undefined {
    return this.provider.address();
  }

  get lastSendResult(): QrSendMarker | undefined {
    return this._lastSendResult;
  }

  async send(args: SenderArguments): Promise<void> {
    if (!this.address) {
      throw new Error('QrSender wallet is not connected');
    }

    if (args.extracurrency) {
      throw new Error('QrSender does not support extracurrency');
    }

    if (
      args.sendMode !== undefined
      && args.sendMode !== SendMode.PAY_GAS_SEPARATELY
    ) {
      throw new Error(
        'QrSender supports only SendMode.PAY_GAS_SEPARATELY'
      );
    }

    const info = await this.client.getAddressInformation(this.address);

    const result = await this.provider.sendTransaction(
      args.to,
      args.value,
      args.body ?? undefined,
      args.init ?? undefined
    );

    this._lastSendResult = {
      kind: 'tonconnect',
      walletAddress: this.address.toString(),
      beforeLt: info.last_transaction_lt ?? null,
      sentAt: Date.now(),
      result,
    };
  }
}