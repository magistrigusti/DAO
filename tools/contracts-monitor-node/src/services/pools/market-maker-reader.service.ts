import { TonProvider } from '../../providers/ton.provider.js';
import type { MarketMakerRawState } from '../../types/monitor.types.js';

function toSafeNumber(
    value: bigint,
    fieldName: string
): number {
    if (value < 0n) {
        throw new Error(`${fieldName} can not be negative.`);
    }

    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(`${fieldName} is too large for number.`);
    }

    return Number(value);
}

// ========== MARKET MAKER: ЧТЕНИЕ GETTER ==========
export class MarketMakerReaderService {
    constructor(
        private readonly provider: TonProvider,
        private readonly marketMakerAddress: string
    ) {}

    async readState(): Promise<MarketMakerRawState> {
        const readAtMs = Date.now();
        const readAt = new Date(readAtMs).toISOString();

        const marketResult = await this.provider.runGetMethod(
            this.marketMakerAddress,
            'getMarketData'
        );

        const ownerAddress = marketResult.stack
            .readAddress()
            .toString();

        const walletAddress = marketResult.stack
            .readAddress()
            .toString();

        const whitelistCount = toSafeNumber(
            marketResult.stack.readBigNumber(),
            'whitelistCount'
        );

        const walletResult = await this.provider.runGetMethod(
            walletAddress,
            'getWalletData'
        );

        const domBalanceNano = walletResult.stack.readBigNumber();

        // В getWalletData дальше идут owner/master/gasPool.
        walletResult.stack.readAddress();
        walletResult.stack.readAddress();
        const walletGasPoolAddress = walletResult.stack
            .readAddress()
            .toString();

        const tonBalanceNano = await this.provider.getBalance(
            this.marketMakerAddress
        );

        return {
            readAt,
            readAtMs,
            address: this.provider.normalizeAddress(
                this.marketMakerAddress
            ),
            ownerAddress,
            walletAddress: this.provider.normalizeAddress(walletAddress),
            walletGasPoolAddress,
            whitelistCount,
            domBalanceNano,
            tonBalanceNano,
        };
    }
}
