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
fun sendMint(amount: int) {
    // Формируем сообщение для Master
    var msg = beginCell()
        .storeUint(0x18, 6)              // флаги
        .storeSlice(masterAddress)        // получатель = Master
        .storeCoins(0)                    // value (будет из баланса)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)  // body в ref
        .storeRef(
            beginCell()
                .storeUint(OP_MINT, 32)   // op-код минта
                .storeUint(0, 64)         // query_id
                .storeCoins(amount)       // сколько минтить
                .endCell()
        )
        .endCell();
    
    // Отправляем с флагом 64 (carry remaining gas)
    sendRawMessage(msg, 64);
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
    
    // Парсим отправителя
    var cs = msgFull.beginParse();
    var flags = cs.loadUint(4);
    
    // Bounced сообщения — игнорируем
    if (flags & 1) {
        return;
    }
    
    var senderAddress = cs.loadMsgAddress();
    
    // Загружаем данные
    loadData();
    
    // Читаем op-код
    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);
    
    // OP_MINT — запрос минта от admin
    if (op == OP_MINT) {
        // Проверяем что отправитель = admin
        assert(
            senderAddress.equalSlices(adminAddress),
            ERROR_NOT_OWNER
        );
        
        // Читаем сколько минтить
        var amount = msgBody.loadCoins();
        
        // Проверяем что amount > 0
        assert(amount > 0, ERROR_INVALID_AMOUNT);
        
        // Отправляем команду минта на Master
        // Master сам проверит лимит и увеличит total_supply
        sendMint(amount);
        
        return;
    }
    
    // Неизвестный op-код — отбиваем
    throw(0xffff);
}

// =====================================================
// GETTERS
// =====================================================

// Получить данные Minter'а
get fun getMinterData(): (slice, slice) {
    loadData();
    return (adminAddress, masterAddress);
}