// =====================================================
// ОШИБКИ — Коды ошибок для всех контрактов DOM
// =====================================================

// Ошибки авторизации
const ERROR_NOT_MINTER: int = 73;           // Не от Minter
const ERROR_NOT_MASTER: int = 74;           // Не от Master
const ERROR_NOT_OWNER: int = 75;            // Не владелец

// Ошибки лимитов
const ERROR_LIMIT_EXCEEDED: int = 76;       // Лимит > 1 млрд
const ERROR_INVALID_AMOUNT: int = 77;       // Неверная сумма (0 или отриц.)
const ERROR_INSUFFICIENT_BALANCE: int = 78; // Недостаточно баланса

// Ошибки адресов
const ERROR_NOT_VALID_WALLET: int = 79;     // Неверный wallet
const ERROR_NOT_IN_WHITELIST: int = 80;     // Адрес не в whitelist

// Ошибки газа
const ERROR_INSUFFICIENT_GAS: int = 81;     // Недостаточно газа для налога