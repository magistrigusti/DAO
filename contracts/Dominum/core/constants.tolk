// =====================================================
// КОНСТАНТЫ — параметры системы DOM
// =====================================================

// -----------------------------------------------------
// TOKEN DOM
// -----------------------------------------------------
const DECIMALS: int = 6;
const ONE_DOM: int = 1000000;

// 1_000_000_000 DOM в минимальных единицах.
const MAX_SUPPLY: int = 1000000000000000;

// -----------------------------------------------------
// РАСПРЕДЕЛЕНИЕ MINT МЕЖДУ 4 ГИВЕРАМИ
// -----------------------------------------------------
const GIVERS_COUNT: int = 4;

const SHARE_ALLODIUM: int = 25;
const SHARE_DEFI: int = 25;
const SHARE_DAO: int = 25;
const SHARE_DOMINUM: int = 25;

// -----------------------------------------------------
// MINT LIMITS
// -----------------------------------------------------
const MIN_MINT_AMOUNT: int = ONE_DOM;

// 1_000_000 DOM за один mint.
const MAX_MINT_AMOUNT: int = 1000000000000;

// Testnet: 1 час.
// Mainnet: 30 дней.
// Перед mainnet меняем MINT_INTERVAL на MAINNET_MINT_INTERVAL.
const TESTNET_MINT_INTERVAL: int = 3600;
const MAINNET_MINT_INTERVAL: int = 2592000;

const MINT_INTERVAL: int = TESTNET_MINT_INTERVAL;

// -----------------------------------------------------
// TON GAS / STORAGE
// -----------------------------------------------------
const MIN_TON_FOR_STORAGE: int = 5000000;
const MIN_TON_FOR_TRANSFER: int = 20000000;
const BASE_TON_COST: int = 50000000;

// -----------------------------------------------------
// DOM FEE
// -----------------------------------------------------
const MIN_DOM_TRANSFER_FEE: int = ONE_DOM;
const MAX_DOM_TRANSFER_FEE: int = ONE_DOM * 3;

// -----------------------------------------------------
// TAX SYSTEM
// -----------------------------------------------------
const TAX_MULTIPLIER: int = 300;
const TAX_MULTIPLIER_DENOM: int = 100;

const MIN_TAX_MULTIPLIER: int = 100;
const MAX_TAX_MULTIPLIER: int = 1000;

const PROFIT_SHARE_GAS_POOL: int = 1;
const PROFIT_SHARE_TREASURY: int = 1;

// -----------------------------------------------------
// DOM / TON RATE
// -----------------------------------------------------
const INITIAL_DOM_PER_TON: int = 10000000;
const NANO_TON: int = 1000000000;

// -----------------------------------------------------
// GIVER
// -----------------------------------------------------
const GIVER_MAX_FEE_DOM: int = 3000000;

// -----------------------------------------------------
// FRS — DOM <-> ALLOD
// -----------------------------------------------------
const EXCHANGE_RATE_DOM_TO_ALLOD: int = 100;

// -----------------------------------------------------
// LOCK
// -----------------------------------------------------
const LOCK_MONTHS: int = 12;
const SECONDS_PER_MONTH: int = 2592000;


const PENDING_NONE: int = 0;
const PENDING_ADDRESS: int = 1;
const PENDING_TAX: int = 2;
