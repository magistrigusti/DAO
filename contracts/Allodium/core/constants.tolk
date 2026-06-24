// =====================================================
// КОНСТАНТЫ ALLODIUM
// =====================================================

// Decimals токенов.
const DOM_DECIMALS: int = 6;
const ALLOD_DECIMALS: int = 4;
const DUBLON_DECIMALS: int = 3;

// Курс FRS: 1 DOM = 100 ALLOD.
const EXCHANGE_RATE_DOM_TO_ALLOD: int = 100;

// 10^(DOM_DECIMALS - ALLOD_DECIMALS) = 100.
const EXCHANGE_DECIMALS_FACTOR: int = 100;

// Fee за перевод ALLOD в минимальных единицах ALLOD.
// 1 ALLOD = 10_000, значит 100 = 0.01 ALLOD.
const ALLOD_TRANSFER_FEE_DEFAULT: int = 100;
const ALLOD_TRANSFER_FEE_MIN: int = 1;
const ALLOD_TRANSFER_FEE_MAX: int = 100000000;

// GRAM нужен только для оплаты сети TON.
const MIN_GRAMS_FOR_TRANSFER: int = 50000000;
const MIN_GRAMS_FOR_STORAGE: int = 10000000;

// Два внутренних сообщения: получателю и wallet пула.
const ALLOD_GAS_TRANSFER_GRAMS_BUDGET: int = 100000000;