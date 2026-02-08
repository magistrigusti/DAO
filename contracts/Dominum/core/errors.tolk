// =====================================================
// ОШИБКИ — Коды ошибок для всех контрактов DOM
// =====================================================

// Ошибки авторизации
const ERROR_NOT_MINTER: int = 73;
const ERROR_NOT_MASTER: int = 74;
const ERROR_NOT_OWNER: int = 75;
const ERROR_NOT_ADMIN: int = 76;
const ERROR_NOT_MANAGER: int = 77;

// Ошибки лимитов
const ERROR_LIMIT_EXCEEDED: int = 80;
const ERROR_INVALID_AMOUNT: int = 81;
const ERROR_INSUFFICIENT_BALANCE: int = 82;

// Ошибки адресов
const ERROR_NOT_VALID_WALLET: int = 85;
const ERROR_NOT_IN_WHITELIST: int = 86;

// Ошибки газа
const ERROR_INSUFFICIENT_GAS: int = 90;

// Ошибки времени
const ERROR_TOO_EARLY: int = 91;

// Ошибки Proxy
const ERROR_NO_PENDING: int = 92;
const ERROR_NOT_ENOUGH_BALANCE: int = 93;