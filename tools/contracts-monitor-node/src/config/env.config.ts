import { resolve } from 'node:path';

import type {
    MonitorConfig,
    NetworkKind,
} from '../types/monitor.types.js';

function readRequiredString(name: string): string {
    const value = process.env[name]?.trim();

    if (!value) {
        throw new Error(
            `Environment variable "${name}" is required.`
        );
    }

    return value;
}

function readOptionalString(name: string): string | undefined {
    const value = process.env[name]?.trim();

    if (!value) {
        return undefined;
    }

    return value;
}

function readPositiveNumber(
    name: string,
    fallback: number
): number {
    const raw = process.env[name]?.trim();

    if (!raw) {
        return fallback;
    }

    const parsed = Number(raw);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(
            `Environment variable "${name}" must be a positive number.`
        );
    }

    return parsed;
}

function readNetwork(): NetworkKind {
    const raw = process.env.NETWORK?.trim().toLowerCase();

    if (
        raw === 'mainnet' ||
        raw === 'testnet' ||
        raw === 'custom'
    ) {
        return raw;
    }

    return 'custom';
}

export function loadMonitorConfig(): MonitorConfig {
    return {
        network: readNetwork(),
        tonEndpoint: readRequiredString('TON_ENDPOINT'),
        tonApiKey: readOptionalString('TON_API_KEY'),
        gasPoolAddress: readRequiredString('GAS_POOL_ADDRESS'),
        marketMakerAddress: readOptionalString('MARKET_MAKER_ADDRESS'),
        pollIntervalMs: readPositiveNumber('POLL_INTERVAL_MS', 30000),
        outputFilePath: resolve(
            process.cwd(),
            readOptionalString('OUTPUT_FILE_PATH') ?? './data/latest.json'
        ),
        domDecimals: readPositiveNumber('DOM_DECIMALS', 6),
        tonDecimals: readPositiveNumber('TON_DECIMALS', 9),
    };
}
