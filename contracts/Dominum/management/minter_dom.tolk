// =====================================================
// MINTER — Контракт запуска минта DOM
// =====================================================
// Роль: точка входа для минта
// - НЕ касается токенов!
// - Только командует Master сколько минтить
// - Проверяет лимит < 1 млрд
// =====================================================

import "../core/op_codes";
import "../core/errors";
import "../core/constants";

// =====================================================
// STORAGE
// =====================================================

global adminAddress: slice;   // кто может минтить
global masterAddress: slice;  // адрес Jetton Master

// Загрузка данных из storage
fun loadData() {
    var ds = getContractData().beginParse();
    
    adminAddress = ds.loadMsgAddress();
    masterAddress = ds.loadMsgAddress();
}

// Сохранение данных в storage
fun saveData() {
    setContractData(
        beginCell()
            .storeSlice(adminAddress)
            .storeSlice(masterAddress)
            .endCell()
    );
}

// =====================================================
// ОСНОВНАЯ ЛОГИКА
// =====================================================

// Отправка OP_MINT на Master
fun sendMint(amount: int, queryId: int, forwardValue: int) {
    var msg = beginCell()
        .storeUint(0x18, 6)                 // флаги
        .storeSlice(masterAddress)          // получатель = Master
        .storeCoins(forwardValue)           // TON на 4 отправки
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

// =====================================================
// ОБРАБОТКА ВХОДЯЩИХ СООБЩЕНИЙ
// =====================================================

fun onInternalMessage(
    myBalance: int,
    msgValue: int,
    msgFull: cell,
    msgBody: slice
) {
    // Пустое сообщение — игнорируем
    if (msgBody.isEndOfSlice()) {
        return;
    }
    
    var cs = msgFull.beginParse();
    var flags = cs.loadUint(4);
    
    // Bounced сообщения — игнорируем
    if (flags & 1) {
        return;
    }
    
    var senderAddress = cs.loadMsgAddress();
    
    loadData();
    
    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);
    
    // OP_MINT — запрос минта от admin
    if (op == OP_MINT) {
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_OWNER
        );
        
        var amount = msgBody.loadCoins();
        assert(amount > 0, ERROR_INVALID_AMOUNT);

        assert(
            msgValue >= MIN_TON_FOR_TRANSFER * 4 + MIN_TON_FOR_STORAGE,
            ERROR_INSUFFICIENT_GAS
        );

        var forwardValue = msgValue - MIN_TON_FOR_STORAGE;

        sendMint(amount, queryId, forwardValue);
        
        return;
    }
    
    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================

get fun getMinterData(): (slice, slice) {
    loadData();
    return (adminAddress, masterAddress);
}