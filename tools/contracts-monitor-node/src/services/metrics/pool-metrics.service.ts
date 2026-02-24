import type {
    GasPoolRawState,
    GasPoolView,
    MarketMakerRawState,
    MarketMakerView,
} from '../../types/monitor.types.js';

import {
    absBigint,
    formatRatio,
    formatUnits,
} from '../../utils/number.utils.js';

type PreviousGasPool = {
    domBalanceNano: bigint;
    availableTonNano: bigint;
    readAtMs: number;
};

type PreviousMarketMaker = {
    domBalanceNano: bigint;
    tonBalanceNano: bigint;
    readAtMs: number;
};

// ========== МЕТРИКИ ПУЛОВ ==========
export class PoolMetricsService {
    private previousGasPool?: PreviousGasPool;
    private previousMarketMaker?: PreviousMarketMaker;

    constructor(
        private readonly domDecimals: number,
        private readonly tonDecimals: number
    ) {}

    toGasPoolView(raw: GasPoolRawState): GasPoolView {
        const previous = this.previousGasPool;
        const domDeltaNano = previous
            ? absBigint(raw.domBalanceNano - previous.domBalanceNano)
            : 0n;

        const tonDeltaNano = previous
            ? absBigint(raw.availableTonNano - previous.availableTonNano)
            : 0n;

        const intervalMs = previous
            ? raw.readAtMs - previous.readAtMs
            : null;

        this.previousGasPool = {
            domBalanceNano: raw.domBalanceNano,
            availableTonNano: raw.availableTonNano,
            readAtMs: raw.readAtMs,
        };

        return {
            readAt: raw.readAt,
            address: raw.address,
            adminAddress: raw.adminAddress,
            proxyAddress: raw.proxyAddress,
            domTreasuryAddress: raw.domTreasuryAddress,
            priceTonPerDom: formatRatio(
                raw.availableTonNano,
                this.tonDecimals,
                raw.domBalanceNano,
                this.domDecimals
            ),
            balances: {
                dom: formatUnits(raw.domBalanceNano, this.domDecimals),
                tonReserve: formatUnits(raw.tonReserveNano, this.tonDecimals),
                tonAvailable: formatUnits(raw.availableTonNano, this.tonDecimals),
            },
            raw: {
                domBalanceNano: raw.domBalanceNano.toString(),
                tonReserveNano: raw.tonReserveNano.toString(),
                availableTonNano: raw.availableTonNano.toString(),
            },
            volumes: {
                domDelta: formatUnits(domDeltaNano, this.domDecimals),
                tonDelta: formatUnits(tonDeltaNano, this.tonDecimals),
                intervalMs,
            },
        };
    }

    toMarketMakerView(raw: MarketMakerRawState): MarketMakerView {
        const previous = this.previousMarketMaker;
        const domDeltaNano = previous
            ? absBigint(raw.domBalanceNano - previous.domBalanceNano)
            : 0n;

        const tonDeltaNano = previous
            ? absBigint(raw.tonBalanceNano - previous.tonBalanceNano)
            : 0n;

        const intervalMs = previous
            ? raw.readAtMs - previous.readAtMs
            : null;

        this.previousMarketMaker = {
            domBalanceNano: raw.domBalanceNano,
            tonBalanceNano: raw.tonBalanceNano,
            readAtMs: raw.readAtMs,
        };

        return {
            readAt: raw.readAt,
            address: raw.address,
            ownerAddress: raw.ownerAddress,
            walletAddress: raw.walletAddress,
            walletGasPoolAddress: raw.walletGasPoolAddress,
            whitelistCount: raw.whitelistCount,
            balances: {
                dom: formatUnits(raw.domBalanceNano, this.domDecimals),
                ton: formatUnits(raw.tonBalanceNano, this.tonDecimals),
            },
            raw: {
                domBalanceNano: raw.domBalanceNano.toString(),
                tonBalanceNano: raw.tonBalanceNano.toString(),
            },
            volumes: {
                domDelta: formatUnits(domDeltaNano, this.domDecimals),
                tonDelta: formatUnits(tonDeltaNano, this.tonDecimals),
                intervalMs,
            },
        };
    }
}
