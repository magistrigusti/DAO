// =====================================================
// OP-КОДЫ — Все операции системы DOM
// =====================================================

// =====================================================
// JETTON СТАНДАРТ (TEP-74)
// =====================================================

// Wallet → Wallet (transfer)
const OP_TRANSFER: int = 0xf8a7ea5;

// Master → Wallet (внутренний трансфер при минте)
const OP_INTERNAL_TRANSFER: int = 0x178d4519;

// Wallet → Master (сжигание)
const OP_BURN: int = 0x595f07bc;
const OP_BURN_NOTIFICATION: int = 0x7bdd97de;

// Уведомление о получении токенов
const OP_TRANSFER_NOTIFICATION: int = 0x7362d09c;

// Возврат излишков газа
const OP_EXCESSES: int = 0xd53276db;

// =====================================================
// MINTER → MASTER
// =====================================================

// Команда минта
const OP_MINT: int = 0x15;

// =====================================================
// GIVER ОПЕРАЦИИ
// =====================================================

// Admin гивера → отправить жетоны на whitelist
const OP_SEND_JETTONS: int = 0x20;

// Manager → Giver (смена admin)
const OP_CHANGE_GIVER_ADMIN: int = 0x21;

// =====================================================
// MANAGER ОПЕРАЦИИ
// =====================================================

// Admin Manager → сменить admin на гивере
const OP_MANAGER_CHANGE_GIVER_ADMIN: int = 0x30;

// Master → Manager (смена admin Manager'а)
const OP_CHANGE_MANAGER_ADMIN: int = 0x31;

// =====================================================
// MASTER ОПЕРАЦИИ
// =====================================================

// Admin Master → заменить Manager контракт
const OP_REPLACE_MANAGER: int = 0x40;

// Admin Master → сменить admin Master'а
const OP_CHANGE_MASTER_ADMIN: int = 0x41;

// =====================================================
// TREASURY ОПЕРАЦИИ (налог)
// =====================================================

// Wallet → Treasury (приём налога)
const OP_RECEIVE_TAX: int = 0x50;

// Admin Treasury → вывод средств
const OP_WITHDRAW: int = 0x51;