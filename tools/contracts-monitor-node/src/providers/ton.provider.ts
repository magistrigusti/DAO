import { Address } from '@ton/core';
import { TonClient } from '@ton/ton';

export type TonProviderConfig = {
    endpoint: string;
    apiKey?: string;
};

export type GetMethodResult = Awaited<
    ReturnType<TonClient['runMethod']>
>;

export class TonProvider {
    private readonly client: TonClient;

    constructor(config: TonProviderConfig) {
        this.client = new TonClient({
            endpoint: config.endpoint,
            apiKey: config.apiKey,
        });
    }

    async runGetMethod(
        address: string,
        method: string
    ): Promise<GetMethodResult> {
        return this.client.runMethod(
            Address.parse(address),
            method
        );
    }

    async getBalance(address: string): Promise<bigint> {
        return this.client.getBalance(
            Address.parse(address)
        );
    }

    normalizeAddress(address: string): string {
        return Address
            .parse(address)
            .toString();
    }
}
