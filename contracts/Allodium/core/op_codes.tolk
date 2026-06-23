// =====================================================
// OP-КОДЫ ALLODIUM
// =====================================================

// Jetton стандарт TEP-74.
const OP_TRANSFER: int = 0xf8a7ea5;
const OP_INTERNAL_TRANSFER: int = 0x178d4519;
const OP_BURN: int = 0x595f07bc;
const OP_BURN_NOTIFICATION: int = 0x7bdd97de;
const OP_TRANSFER_NOTIFICATION: int = 0x7362d09c;
const OP_EXCESSES: int = 0xd53276db;

// ALLOD Master.
const OP_MINT: int = 0x15;

// Allodium Foundation.
const OP_WITHDRAW: int = 0x51;
const OP_WITHDRAW_JETTONS: int = 0x52;
const OP_ADD_WHITELIST: int = 0xe0;
const OP_REMOVE_WHITELIST: int = 0xe1;
const OP_PROTOCOL_TRANSFER: int = 0x5A;

// FRS Allodium.
const OP_INCREASE_MINT_ALLOWANCE: int = 0x100;
const OP_ALLOD_BURNED: int = 0x101;

// AllodGasPool.
// Wallet платит fee в ALLOD, pool оплачивает TON-сообщения.
const OP_ALLOD_GAS_POOL_EXECUTE: int = 0xa110d001;
const OP_INIT_ALLOD_MASTER_CONFIG: int = 0xa110d002;
const OP_CHANGE_ALLOD_TRANSFER_FEE: int = 0xa110d003;
const OP_ALLOD_GAS_TOP_UP: int = 0xa110d004;
