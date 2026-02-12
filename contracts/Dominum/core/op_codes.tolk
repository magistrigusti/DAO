// =====================================================
// OP-КОДЫ — Все операции системы DOM
// =====================================================

// =====================================================
// JETTON СТАНДАРТ (TEP-74)
// =====================================================

const OP_TRANSFER: int = 0xf8a7ea5;
const OP_INTERNAL_TRANSFER: int = 0x178d4519;
const OP_BURN: int = 0x595f07bc;
const OP_BURN_NOTIFICATION: int = 0x7bdd97de;
const OP_TRANSFER_NOTIFICATION: int = 0x7362d09c;
const OP_EXCESSES: int = 0xd53276db;

// =====================================================
// MINTER → MASTER
// =====================================================

const OP_MINT: int = 0x15;

// =====================================================
// GIVER ОПЕРАЦИИ
// =====================================================

const OP_SEND_JETTONS: int = 0x20;
const OP_CHANGE_WHITELIST: int = 0x40;

// =====================================================
// TREASURY ОПЕРАЦИИ
// =====================================================

const OP_WITHDRAW: int = 0x51;
const OP_WITHDRAW_JETTONS: int = 0x52;

// =====================================================
// GAS POOL ОПЕРАЦИИ
// =====================================================

const OP_GAS_POOL_EXECUTE: int = 0xA0;
const OP_TOP_UP: int = 0xA1;
const OP_WITHDRAW_DOM: int = 0xA2;
const OP_WITHDRAW_TON: int = 0xA3;
const OP_SET_RESERVE: int = 0xA4;
const OP_CHANGE_TREASURY: int = 0xA5;

// =====================================================
// PROXY GAS POOL ОПЕРАЦИИ
// =====================================================

const OP_REQUEST_CHANGE_POOL: int = 0xB0;
const OP_CONFIRM_CHANGE_POOL: int = 0xB1;
const OP_CANCEL_CHANGE_POOL: int = 0xB2;
const OP_PROXY_INTERNAL_TRANSFER: int = 0xB3;

// =====================================================
// FRS ALLODIUM
// =====================================================

const OP_INCREASE_MINT_ALLOWANCE: int = 0x70;
const OP_ALLOD_BURNED: int = 0x71;

// =====================================================
// BANK DAO
// =====================================================

const OP_ISSUE_BOND: int = 0xC0;
const OP_PAY_COUPON: int = 0xC1;
const OP_REDEEM_BOND: int = 0xC2;

// =====================================================
// DAO FOUNDATION
// =====================================================

const OP_ISSUE_SHARE: int = 0xD0;
const OP_DISTRIBUTE_PROFIT: int = 0xD1;
const OP_DAO_WITHDRAW: int = 0xD2;

// =====================================================
// NFT
// =====================================================

const OP_MINT_NFT: int = 0x1;

// =====================================================
// MARKET MAKER ОПЕРАЦИИ
// =====================================================

const OP_ADD_WHITELIST: int = 0xE0;
const OP_REMOVE_WHITELIST: int = 0xE1;