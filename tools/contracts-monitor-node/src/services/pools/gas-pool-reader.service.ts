import { TonProvider } from '../../providers/ton.provider.js';
import type { GasPoolRawState } from '../../types/monitor.types.js';

// ========== ГАЗОВЫЙ ПУЛ: ЧТЕНИЕ GETTER ==========
export class GasPoolReaderService {
    constructor(
        private readonly provider: TonProvider,
        private readonly gasPoolAddress: string
    ) {}

    async readState(): Promise<GasPoolRawState> {
        const readAtMs = Date.now();
        const readAt = new Date(readAtMs).toISOString();

        const result = await this.provider.runGetMethod(
            this.gasPoolAddress,
            'getPoolData'
        );

        const adminAddress = result.stack
            .readAddress()
            .toString();

        const proxyAddress = result.stack
            .readAddress()
            .toString();

        const domTreasuryAddress = result.stack
            .readAddress()
            .toString();

        const domBalanceNano = result.stack.readBigNumber();
        const tonReserveNano = result.stack.readBigNumber();
        const availableTonNano = result.stack.readBigNumber();

        return {
            readAt,
            readAtMs,
            address: this.provider.normalizeAddress(this.gasPoolAddress),
            adminAddress,
            proxyAddress,
            domTreasuryAddress,
            domBalanceNano,
            tonReserveNano,
            availableTonNano,
        };
    }
}
