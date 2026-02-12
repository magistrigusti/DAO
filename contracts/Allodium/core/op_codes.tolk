// =====================================================
// OP-КОДЫ ALLODIUM
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
// MASTER ALLOD ОПЕРАЦИИ
// =====================================================
const OP_MINT: int = 0x15;

// =====================================================
// FOUNDATION ОПЕРАЦИИ
// =====================================================
const OP_WITHDRAW: int = 0x51;
const OP_WITHDRAW_JETTONS: int = 0x52;

// =====================================================
// FRS <-> MASTER ALLOD
// =====================================================
const OP_INCREASE_MINT_ALLOWANCE: int = 0x100;
const OP_ALLOD_BURNED: int = 0x101;