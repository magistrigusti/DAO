// =====================================================
// OP-КОДЫ — Коды операций для всех контрактов DOM
// =====================================================

// Minter → Master
const OP_MINT: int = 0x15;

// Master → Giver (внутренний трансфер)
const OP_INTERNAL_TRANSFER: int = 0x178d4519;

// Giver → Wallet (создание wallet наружу)
const OP_TRANSFER: int = 0xf8a7ea5;

// Wallet → Master (сжигание)
const OP_BURN: int = 0x595f07bc;
const OP_BURN_NOTIFICATION: int = 0x7bdd97de;

// Возврат излишков
const OP_EXCESSES: int = 0xd53276db;