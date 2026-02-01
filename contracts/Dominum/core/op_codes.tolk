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

// GIVER MANAGER
const OP_CHANGE_WHITELIST: int = 0x40;  // Смена whitelist на гивере

// =====================================================
// MASTER ОПЕРАЦИИ
// =====================================================

// Admin Master → заменить Manager контракт
const OP_REPLACE_MANAGER: int = 0x40;

// Admin Master → сменить admin Master'а
const OP_CHANGE_MASTER_ADMIN: int = 0x41;

// =====================================================
// TREASURY ОПЕРАЦИИ
// =====================================================

// Wallet → Treasury (приём налога)
const OP_RECEIVE_TAX: int = 0x50;

// Admin Treasury → вывод TON
const OP_WITHDRAW: int = 0x51;

// Admin Treasury → вывод жетонов
const OP_WITHDRAW_JETTONS: int = 0x52;

// Admin → смена admin (общий для многих контрактов)
const OP_CHANGE_ADMIN: int = 0x60;

// =====================================================
// FRS ALLODIUM ↔ ALLOD MASTER
// =====================================================

// FRS → ALLOD Master (разрешить минт ALLOD)
const OP_INCREASE_MINT_ALLOWANCE: int = 0x70;

// ALLOD Master → FRS (ALLOD сожжён, разблокировать DOM)
const OP_ALLOD_BURNED: int = 0x71;

// BANK DAO
const OP_ISSUE_BOND: int = 0x50;       // Выпустить облигацию
const OP_PAY_COUPON: int = 0x51;       // Выплатить купон
const OP_REDEEM_BOND: int = 0x52;      // Погасить облигацию

// DAO FOUNDATION
const OP_ISSUE_SHARE: int = 0x60;       // Выпустить акцию
const OP_DISTRIBUTE_PROFIT: int = 0x61; // Распределить на 5 контрактов
const OP_DAO_WITHDRAW: int = 0x62;      // Вывести средства (DAO Foundation)

// NFT
const OP_MINT_NFT: int = 0x1;          // Минт NFT (стандартный)

// GAS POOL
const OP_UPDATE_RATE: int = 0x70;       // Обновить курс
const OP_WITHDRAW_DOM: int = 0x71;      // Вывести DOM из пула
const OP_ADD_TON_RESERVE: int = 0x72;   // Пополнить TON

// TREASURY MANAGER
const OP_UPDATE_DOM_TREASURY: int = 0x80;
const OP_UPDATE_DAO_TREASURY: int = 0x81;
const OP_UPDATE_GAS_POOL: int = 0x82;
const OP_UPDATE_POOL_RATE: int = 0x83;
const OP_WITHDRAW_FROM_POOL: int = 0x84;
const OP_REFILL_POOL: int = 0x85;

// BANK DOMINUM
const OP_CHANGE_TREASURY_MANAGER: int = 0x90;

// GAS POOL
const OP_REQUEST_GAS: int = 0x73;      // Запрос TON для газа
const OP_REFILL_CONTRACT: int = 0x74;  // Пополнить контракт TON'ом
const OP_GAS_POOL_EXECUTE: int = 0x70;  // выполнить transfer через пул
const OP_TOP_UP: int = 0x71;            // пополнить TON
const OP_WITHDRAW_DOM: int = 0x72;      // вывести DOM
const OP_WITHDRAW_TON: int = 0x73;      // вывести TON
const OP_SET_RESERVE: int = 0x74;       // установить резерв