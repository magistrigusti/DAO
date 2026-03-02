import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';

import { loadMonitorConfig } from './config/env.config.js';
import { TonProvider } from './providers/ton.provider.js';
import { PoolMetricsService } from './services/metrics/pool-metrics.service.js';
import { SnapshotWriterService } from './services/output/snapshot-writer.service.js';
import { GasPoolReaderService } from './services/pools/gas-pool-reader.service.js';
import { MarketMakerReaderService } from './services/pools/market-maker-reader.service.js';
import type {
    GasPoolView,
    MarketMakerView,
    MonitorSnapshot,
} from './types/monitor.types.js';

const ERROR_RETRY_DELAY_MS = 5000;

// ========== ЗАГРУЗКА ENV ==========
loadEnv({
    path: resolve(process.cwd(), '.env'),
});

loadEnv({
    path: resolve(process.cwd(), '.env.example'),
});

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return 'Unknown error';
}

function printCycleResult(
    snapshot: MonitorSnapshot,
    outputFilePath: string
): void {
    const gasPool = snapshot.pools.gasPool;
    const marketMaker = snapshot.pools.marketMaker;

    if (gasPool.status === 'ok') {
        console.log(
            `[monitor-node] ${snapshot.generatedAt} ` +
            `price TON/DOM=${gasPool.priceTonPerDom} ` +
            `DOM delta=${gasPool.volumes.domDelta} ` +
            `TON delta=${gasPool.volumes.tonDelta}`
        );
    } else {
        console.log(
            `[monitor-node] ${snapshot.generatedAt} ` +
            `gas-pool read failed: ${gasPool.error ?? 'Unknown error'}`
        );
    }

    if (marketMaker) {
        if (marketMaker.status === 'ok') {
            console.log(
                `[monitor-node] market-maker ` +
                `DOM delta=${marketMaker.volumes.domDelta} ` +
                `TON delta=${marketMaker.volumes.tonDelta} ` +
                `whitelist=${marketMaker.whitelistCount}`
            );
        } else {
            console.log(
                `[monitor-node] market-maker read failed: ` +
                `${marketMaker.error ?? 'Unknown error'}`
            );
        }
    }

    console.log(`[monitor-node] snapshot saved: ${outputFilePath}`);
}

function buildGasPoolErrorView(
    address: string,
    error: string
): GasPoolView {
    return {
        status: 'error',
        error,
        readAt: new Date().toISOString(),
        address,
        adminAddress: '',
        proxyAddress: '',
        domTreasuryAddress: '',
        priceTonPerDom: '0',
        balances: {
            dom: '0',
            tonReserve: '0',
            tonAvailable: '0',
        },
        raw: {
            domBalanceNano: '0',
            tonReserveNano: '0',
            availableTonNano: '0',
        },
        volumes: {
            domDelta: '0',
            tonDelta: '0',
            intervalMs: null,
        },
    };
}

function buildMarketMakerErrorView(
    address: string,
    error: string
): MarketMakerView {
    return {
        status: 'error',
        error,
        readAt: new Date().toISOString(),
        address,
        ownerAddress: '',
        walletAddress: '',
        walletGasPoolAddress: '',
        whitelistCount: 0,
        balances: {
            dom: '0',
            ton: '0',
        },
        raw: {
            domBalanceNano: '0',
            tonBalanceNano: '0',
        },
        volumes: {
            domDelta: '0',
            tonDelta: '0',
            intervalMs: null,
        },
    };
}

// ========== ГЛАВНЫЙ ЦИКЛ НОДЫ ==========
async function run(): Promise<void> {
    const config = loadMonitorConfig();

    const provider = new TonProvider({
        endpoint: config.tonEndpoint,
        apiKey: config.tonApiKey,
    });

    const gasPoolReader = new GasPoolReaderService(
        provider,
        config.gasPoolAddress
    );

    const marketMakerReader = config.marketMakerAddress
        ? new MarketMakerReaderService(
              provider,
              config.marketMakerAddress
          )
        : undefined;

    const metrics = new PoolMetricsService(
        config.domDecimals,
        config.tonDecimals
    );

    const writer = new SnapshotWriterService(
        config.outputFilePath
    );

    console.log(
        `[monitor-node] started ` +
        `network=${config.network} ` +
        `poll=${config.pollIntervalMs}ms`
    );

    while (true) {
        try {
            let gasPoolView: GasPoolView;

            try {
                const gasPoolRaw = await gasPoolReader.readState();
                gasPoolView = metrics.toGasPoolView(gasPoolRaw);
            } catch (error) {
                gasPoolView = buildGasPoolErrorView(
                    config.gasPoolAddress,
                    getErrorMessage(error)
                );
            }

            let marketMakerView: MarketMakerView | undefined;

            if (marketMakerReader && config.marketMakerAddress) {
                try {
                    const marketMakerRaw =
                        await marketMakerReader.readState();

                    marketMakerView = metrics.toMarketMakerView(
                        marketMakerRaw
                    );
                } catch (error) {
                    marketMakerView = buildMarketMakerErrorView(
                        config.marketMakerAddress,
                        getErrorMessage(error)
                    );
                }
            }

            const snapshot: MonitorSnapshot = {
                generatedAt: new Date().toISOString(),
                network: config.network,
                endpoint: config.tonEndpoint,
                pools: {
                    gasPool: gasPoolView,
                    ...(marketMakerView
                        ? { marketMaker: marketMakerView }
                        : {}),
                },
            };

            await writer.write(snapshot);
            printCycleResult(snapshot, config.outputFilePath);
            await sleep(config.pollIntervalMs);
        } catch (error) {
            console.error(
                `[monitor-node] cycle failed: ${getErrorMessage(error)}`
            );

            await sleep(ERROR_RETRY_DELAY_MS);
        }
    }
}

run().catch((error: unknown) => {
    console.error(
        `[monitor-node] fatal error: ${getErrorMessage(error)}`
    );
    process.exit(1);
});
