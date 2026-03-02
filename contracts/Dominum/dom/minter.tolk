import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// ========== TOLK MIGRATION v1.2 ==========
// Контракт переписан с legacy API на новый Tolk API.
// Цель: совместимость с @ton/tolk-js >= 1.2.0 и Blueprint >= 0.42.0.
// Статус: migrated
// =========================================

// =====================================================
// MINTER — Контракт минта DOM по расписанию
// =====================================================
// Управляется: СИД-фраза (adminAddress, жёстко!)
// Логика:
//   1) Первый минт — ручной, запускает таймер
//   2) Далее — каждые 30 дней по MINT_AMOUNT
//   3) Admin менять НЕЛЬЗЯ
//   4) Сумму менять НЕЛЬЗЯ
//   5) Master проверяет MAX_SUPPLY
// =====================================================

// 4 гивера в Master
const MINT_TRANSFERS: int = 4;

// Сколько минтить за раз: 10 млн DOM (с 6 decimals)
const MINT_AMOUNT: int = 10000000000000;

// Интервал: 30 дней (в секундах)
const MINT_INTERVAL: int = 2592000;

global adminAddress: address;
global masterAddress: address;
global lastMintTime: int;
global isStarted: bool;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------

fun loadData() {
    var ds = contract.getData().beginParse();

    adminAddress = ds.loadAddress();
    masterAddress = ds.loadAddress();
    lastMintTime = ds.loadUint(64);
    isStarted = ds.loadBool();
}

fun saveData() {
    contract.setData(
        beginCell()
            .storeAddress(adminAddress)
            .storeAddress(masterAddress)
            .storeUint(lastMintTime, 64)
            .storeBool(isStarted)
            .endCell()
    );
}

// -----------------------------------------------------
// ОТПРАВКА МИНТА НА MASTER
// -----------------------------------------------------

fun sendMint(amount: int, queryId: int, forwardValue: int) {
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(masterAddress)
        .storeCoins(forwardValue)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(
            beginCell()
                .storeUint(OP_MINT, 32)
                .storeUint(queryId, 64)
                .storeCoins(amount)
                .endCell()
        )
        .endCell();

    sendRawMessage(msg, 1);
}

// -----------------------------------------------------
// MAIN
// -----------------------------------------------------

fun onInternalMessage(in: InMessage) {
    var msgBody = in.body;

    if (msgBody.isEmpty()) {
        return;
    }

    var senderAddress = in.senderAddress;
    var msgValue = in.valueCoins;

    loadData();

    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);

    // =====================================================
    // OP_MINT — только admin (СИД-фраза)
    // =====================================================
    if (op == OP_MINT) {
        assert(
            senderAddress == adminAddress,
            ERROR_NOT_OWNER
        );

        // Проверяем что хватает TON
        var requiredTon =
            MIN_TON_FOR_TRANSFER * MINT_TRANSFERS
            + MIN_TON_FOR_STORAGE;

        assert(
            msgValue >= requiredTon,
            ERROR_INSUFFICIENT_GAS
        );

        var mintAmount: int = MINT_AMOUNT;

        if (isStarted) {
            // Таймер запущен — проверяем интервал
            assert(
                blockchain.now() >= lastMintTime + MINT_INTERVAL,
                ERROR_TOO_EARLY
            );
        } else {
            // Первый минт — произвольная сумма из сообщения
            var requestedAmount = msgBody.loadCoins();
            assert(requestedAmount > 0, ERROR_INVALID_AMOUNT);
            mintAmount = requestedAmount;

            // Запускаем таймер
            isStarted = true;
        }

        // Записываем время
        lastMintTime = blockchain.now();
        saveData();

        // Отправляем на Master
        var forwardValue = msgValue - MIN_TON_FOR_STORAGE;
        sendMint(mintAmount, queryId, forwardValue);

        return;
    }

    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------

get fun getMinterData(): (address, address, int, int, bool, int) {
    loadData();

    var nextMintTime = lastMintTime + MINT_INTERVAL;

    return (
        adminAddress,
        masterAddress,
        lastMintTime,
        nextMintTime,
        isStarted,
        MINT_AMOUNT
    );
}

get fun canMintNow(): bool {
    loadData();

    if (!isStarted) {
        // Ещё не запущен — можно первый минт
        return true;
    }

    return blockchain.now() >= lastMintTime + MINT_INTERVAL;
}