// =====================================================
// КОНСТАНТЫ ALLODIUM
// =====================================================

// Decimals токенов
const DOM_DECIMALS: int = 6;
const ALLOD_DECIMALS: int = 4;
const DUBLON_DECIMALS: int = 3;

// Курс: 1 DOM = 100 ALLOD
const EXCHANGE_RATE_DOM_TO_ALLOD: int = 100;

// Масштаб для перевода между минимальными единицами:
// 10^(DOM_DECIMALS - ALLOD_DECIMALS) = 10^(6 - 4) = 100
const EXCHANGE_DECIMALS_FACTOR: int = 100;

// Налог на transfer ALLOD: 0.05 TON
const TAX_ALLOD_TON: int = 50000000;

// TON на служебные сообщения
const MIN_TON_FOR_TRANSFER: int = 150000000; // 0.15 TON
const MIN_TON_FOR_STORAGE: int = 10000000;   // 0.01 TON