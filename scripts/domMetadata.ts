// ========== МЕТАДАННЫЕ ТОКЕНОВ DOM / ALLOD ==========
// TEP-64 off-chain: content = 0x01 + snake-encoded URL.
// Имена: Dv1 (DOM v1), Dv2 (DOM v2), Av1 (ALLOD v1).
// =====================================================

import { beginCell, Cell } from '@ton/core';

/** Базовый URL для метаданных (JSON, изображения). */
const DEFAULT_METADATA_BASE = 'https://dominum.vercel.app';

/**
 * Собирает off-chain content cell для jetton (TEP-64).
 * URL указывает на JSON с name, symbol, decimals, image, description.
 */
export function buildDomJettonContent(opts?: {
    baseUrl?: string;
    version?: 'Dv1' | 'Dv2';
}): Cell {
    const base = opts?.baseUrl ?? DEFAULT_METADATA_BASE;
    const url = `${base}/dom-metadata.json`;

    // 0x01 = off-chain, далее snake-encoded URL (ASCII).
    return beginCell()
        .storeUint(0x01, 8)
        .storeStringTail(url)
        .endCell();
}

/**
 * Для ALLOD (Av1) — отдельный файл при необходимости.
 */
export function buildAllodJettonContent(opts?: {
    baseUrl?: string;
}): Cell {
    const base = opts?.baseUrl ?? DEFAULT_METADATA_BASE;
    const url = `${base}/allod-metadata.json`;

    return beginCell()
        .storeUint(0x01, 8)
        .storeStringTail(url)
        .endCell();
}
