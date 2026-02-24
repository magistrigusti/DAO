import 'dotenv/config';

import { loadMonitorConfig } from './config/env.config.js';
import { TonProvider } from './providers/ton.provider.js';
import { PoolMetricsService } from './services/metrics/pool-metrics.service.js';
import { SnapshotWriterService } from './services/output/snapshot-writer.service.js';
import { GasPoolReaderService } from './services/pools/gas-pool-reader.service.js';
import { MarketMakerReaderService } from './services/pools/market-maker-reader.service.js';
import type { MonitorSnapshot } from './types/monitor.types.js';

const ERROR_RETRY_DELAY_MS = 5000;

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

    console.log(
        `[monitor-node] ${snapshot.generatedAt} ` +
        `price TON/DOM=${gasPool.priceTonPerDom} ` +
        `DOM delta=${gasPool.volumes.domDelta} ` +
        `TON delta=${gasPool.volumes.tonDelta}`
    );

    if (marketMaker) {
        console.log(
            `[monitor-node] market-maker ` +
            `DOM delta=${marketMaker.volumes.domDelta} ` +
            `TON delta=${marketMaker.volumes.tonDelta} ` +
            `whitelist=${marketMaker.whitelistCount}`
        );
    }

    console.log(`[monitor-node] snapshot saved: ${outputFilePath}`);
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
            const gasPoolRaw = await gasPoolReader.readState();
            const gasPoolView = metrics.toGasPoolView(gasPoolRaw);

            const marketMakerView = marketMakerReader
                ? metrics.toMarketMakerView(
                      await marketMakerReader.readState()
                  )
                : undefined;

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
