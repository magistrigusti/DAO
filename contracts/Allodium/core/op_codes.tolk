// =====================================================
// OP-КОДЫ ALLODIUM — Операции игрового токена ALLOD
// =====================================================
// Эти коды относятся ТОЛЬКО к Allodium контрактам:
// токен ALLOD (внутриигровая валюта), FRS мост,
// Allodium Foundation.
//
// Для Dominum (экосистема DOM) есть отдельный файл:
// contracts/Dominum/core/op_codes.tolk
//
// ALLOD — это ИГРОВОЙ токен, он живёт только в игре.
// DOM — это общесистемный токен экосистемы.
// Связь между ними — через FRS (Fractional Reserve System):
// 1 DOM блокируется → 100 ALLOD минтится в игре.
// =====================================================

// =====================================================
// JETTON СТАНДАРТ (TEP-74)
// =====================================================
// Значения должны совпадать с Dominum версией,
// потому что это стандарт TEP-74 для всех jetton-ов.
const OP_TRANSFER: int = 0xf8a7ea5;
const OP_INTERNAL_TRANSFER: int = 0x178d4519;
const OP_BURN: int = 0x595f07bc;
const OP_BURN_NOTIFICATION: int = 0x7bdd97de;
const OP_TRANSFER_NOTIFICATION: int = 0x7362d09c;
const OP_EXCESSES: int = 0xd53276db;

// =====================================================
// MASTER ALLOD — минт игрового токена
// =====================================================
// Owner минтит ALLOD только в пределах mintAllowancePool,
// который увеличивает FRS при получении DOM.
const OP_MINT: int = 0x15;

// =====================================================
// ALLODIUM FOUNDATION — вывод средств (owner only)
// =====================================================
const OP_WITHDRAW: int = 0x51;
const OP_WITHDRAW_JETTONS: int = 0x52;

// =====================================================
// FRS МОСТ — DOM ↔ ALLOD
// =====================================================
// OP_INCREASE_MINT_ALLOWANCE:
//   FRS → ALLOD Master
//   Сообщает мастеру: «можно минтить X ALLOD,
//   потому что столько DOM у меня заблокировано»
//
// OP_ALLOD_BURNED:
//   ALLOD Master → FRS
//   Сообщает FRS что сожгли X ALLOD в кошельке,
//   значит можно разблокировать X / 100 DOM
//   и вернуть в Allodium Foundation.
const OP_INCREASE_MINT_ALLOWANCE: int = 0x100;
const OP_ALLOD_BURNED: int = 0x101;