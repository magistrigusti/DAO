import { Address, TupleItem, TupleReader } from '@ton/core';

import { decodeStack, encodeStackItem } from './ToncenterV3Stack';

type QueryValue = string | number | boolean | undefined;
type QueryRecord = Record<string, QueryValue | QueryValue[]>;

export type ToncenterV3AddressInformation = {
  balance: string;
  code?: string;
  data?: string;
  status: string;
  frozen_hash?: string;
  last_transaction_hash?: string;
  last_transaction_lt?: string;
};

export type ToncenterV3SendMessageResult = {
  message_hash: string;
  message_hash_norm?: string;
};

export type ToncenterV3Transaction = Record<string, any>;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function buildUrl(baseUrl: string, path: string, query?: QueryRecord): string {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`);

  if (!query) {
    return url.toString();
  }

  for (const [key, raw] of Object.entries(query)) {
    if (raw === undefined) {
      continue;
    }

    if (Array.isArray(raw)) {
      for (const value of raw) {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      }
      continue;
    }

    url.searchParams.set(key, String(raw));
  }

  return url.toString();
}

export class ToncenterV3Client {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
    private readonly timeoutMs = 30_000
  ) {}

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    query?: QueryRecord,
    body?: unknown
  ): Promise<T> {
    const url = buildUrl(this.baseUrl, path, query);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(`Toncenter v3 ${response.status}: ${text}`);
      }

      return text ? (JSON.parse(text) as T) : ({} as T);
    } finally {
      clearTimeout(timeout);
    }
  }

  async getAddressInformation(address: Address): Promise<ToncenterV3AddressInformation> {
    return this.request<ToncenterV3AddressInformation>('GET', '/addressInformation', {
      address: address.toString(),
    });
  }

  async isContractDeployed(address: Address): Promise<boolean> {
    const info = await this.getAddressInformation(address);
    return info.status === 'active';
  }

  async sendMessage(boc: Buffer | string): Promise<ToncenterV3SendMessageResult & { boc: string }> {
    const bocBase64 = typeof boc === 'string' ? boc : boc.toString('base64');
    const result = await this.request<ToncenterV3SendMessageResult>('POST', '/message', undefined, {
      boc: bocBase64,
    });

    return {
      ...result,
      boc: bocBase64,
    };
  }

  async runGetMethod(
    address: Address,
    method: string,
    stack: TupleItem[]
  ): Promise<{ stack: TupleReader; exitCode: number; gasUsed?: bigint }> {
    const raw = await this.request<any>('POST', '/runGetMethod', undefined, {
      address: address.toString(),
      method,
      stack: stack.map(encodeStackItem),
    });

    const stackReader = decodeStack(raw.stack ?? raw.result?.stack ?? []);
    const exitCode = raw.exitCode ?? raw.exit_code ?? raw.result?.exitCode ?? raw.result?.exit_code ?? 0;

    const gasUsedRaw = raw.gasUsed ?? raw.gas_used ?? raw.result?.gasUsed ?? raw.result?.gas_used;
    const gasUsed = gasUsedRaw === undefined ? undefined : BigInt(String(gasUsedRaw));

    return {
      stack: stackReader,
      exitCode,
      gasUsed,
    };
  }

  async getTransactionsByMessage(messageHash: string, limit = 20): Promise<ToncenterV3Transaction[]> {
    const raw = await this.request<any>('GET', '/transactionsByMessage', {
      msg_hash: messageHash,
      direction: 'in',
      limit,
    });

    return raw.transactions ?? raw.result?.transactions ?? [];
  }

  async getTransactions(address: Address, limit = 20): Promise<ToncenterV3Transaction[]> {
    const raw = await this.request<any>('GET', '/transactions', {
      account: address.toString(),
      limit,
      sort: 'desc',
    });

    return raw.transactions ?? raw.result?.transactions ?? [];
  }
}