import "../core/op_codes.tolk";
import "../core/errors.tolk";
import "../core/constants.tolk";

// =====================================================
// JETTON WALLET — кошелёк DOM (TEP-74)
// =====================================================
// При transfer отправляет ОДНО сообщение на Gas Pool.
// Gas Pool сам распределяет: получателю, DOM Treasury, DAO Treasury.
// Пользователь платит ~0.01 TON + DOM комиссия.
// Gas Pool возвращает TON пользователю.
// =====================================================

const FEE_MAGIC: int = 0xDA0FEE01;

global balance: int;
global ownerAddress: slice;
global masterAddress: slice;
global gasPoolAddress: slice;
global jettonWalletCode: cell;

// -----------------------------------------------------
// LOAD / SAVE
// -----------------------------------------------------

fun loadData() {
    var ds = getContractData().beginParse();
    
    balance = ds.loadCoins();
    ownerAddress = ds.loadMsgAddress();
    masterAddress = ds.loadMsgAddress();
    gasPoolAddress = ds.loadMsgAddress();
    jettonWalletCode = ds.loadRef();
}

fun saveData() {
    setContractData(
        beginCell()
            .storeCoins(balance)
            .storeSlice(ownerAddress)
            .storeSlice(masterAddress)
            .storeSlice(gasPoolAddress)
            .storeRef(jettonWalletCode)
            .endCell()
    );
}

// -----------------------------------------------------
// WALLET ADDRESS
// -----------------------------------------------------

fun buildWalletData(owner: slice): cell {
    return beginCell()
        .storeCoins(0)
        .storeSlice(owner)
        .storeSlice(masterAddress)
        .storeSlice(gasPoolAddress)
        .storeRef(jettonWalletCode)
        .endCell();
}

fun buildWalletStateInit(owner: slice): cell {
    var walletData = buildWalletData(owner);
    
    return beginCell()
        .storeUint(0, 2)
        .storeMaybeRef(jettonWalletCode)
        .storeMaybeRef(walletData)
        .storeUint(0, 1)
        .endCell();
}

fun buildWalletAddress(stateInit: cell): slice {
    return beginCell()
        .storeUint(4, 3)
        .storeInt(0, 8)
        .storeUint(stateInit.hash(), 256)
        .endCell()
        .beginParse();
}

// -----------------------------------------------------
// ВАЛИДАЦИЯ ВНУТРЕННЕГО ОТПРАВИТЕЛЯ
// -----------------------------------------------------

fun requireInternalSender(
    senderAddress: slice,
    fromOwner: slice
) {
    // От Master — всегда ок (mint)
    if (senderAddress.equalSlices(masterAddress)) {
        return;
    }
    
    // От Gas Pool — всегда ок (он делает transfers)
    if (senderAddress.equalSlices(gasPoolAddress)) {
        return;
    }
    
    // Иначе — проверяем что это wallet отправителя
    var expectedWallet = buildWalletAddress(
        buildWalletStateInit(fromOwner)
    );
    
    assert(
        senderAddress.equalSlices(expectedWallet),
        ERROR_NOT_VALID_WALLET
    );
}

// -----------------------------------------------------
// NOTIFY OWNER (transfer_notification)
// -----------------------------------------------------

fun notifyOwner(amount: int, fromOwner: slice, queryId: int) {
    var body = beginCell()
        .storeUint(OP_TRANSFER_NOTIFICATION, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeSlice(fromOwner)
        .endCell();
    
    var msg = beginCell()
        .storeUint(0x10, 6)
        .storeSlice(ownerAddress)
        .storeCoins(0)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    
    sendRawMessage(msg, 64);
}

// -----------------------------------------------------
// MAIN
// -----------------------------------------------------

fun onInternalMessage(
    myBalance: int,
    msgValue: int,
    msgFull: cell,
    msgBody: slice
) {
    if (msgBody.isEndOfSlice()) {
        return;
    }
    
    var cs = msgFull.beginParse();
    var flags = cs.loadUint(4);
    
    // Bounced — игнорируем
    if (flags & 1) {
        return;
    }
    
    var senderAddress = cs.loadMsgAddress();
    
    loadData();
    
    var op = msgBody.loadUint(32);
    var queryId = msgBody.loadUint(64);
    
    // =====================================================
    // OP_INTERNAL_TRANSFER — получили токены
    // =====================================================
    if (op == OP_INTERNAL_TRANSFER) {
        var amount = msgBody.loadCoins();
        var fromOwner = msgBody.loadMsgAddress();
        var responseDestination = msgBody.loadMsgAddress();
        
        requireInternalSender(senderAddress, fromOwner);
        
        balance += amount;
        saveData();
        
        notifyOwner(amount, fromOwner, queryId);
        
        return;
    }
    
    // =====================================================
    // OP_TRANSFER — отправка токенов (только owner)
    // =====================================================
    if (op == OP_TRANSFER) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );
        
        var jettonAmount = msgBody.loadCoins();
        var toOwner = msgBody.loadMsgAddress();
        var responseDestination = msgBody.loadMsgAddress();
        
        assert(jettonAmount > 0, ERROR_INVALID_AMOUNT);
        
        // Читаем комиссии из custom_payload
        var hasCustom = msgBody.loadBool();
        
        var domTreasuryFee: int = TAX_HALF;
        var daoTreasuryFee: int = TAX_HALF;
        var gasPoolFee: int = TAX_HALF;
        
        if (hasCustom) {
            var payload = msgBody.loadRef().beginParse();
            var magic = payload.loadUint(32);
            
            if (magic == FEE_MAGIC) {
                var newDomFee = payload.loadCoins();
                var newDaoFee = payload.loadCoins();
                var newGasFee = payload.loadCoins();
                
                if (newDomFee > domTreasuryFee) {
                    domTreasuryFee = newDomFee;
                }
                if (newDaoFee > daoTreasuryFee) {
                    daoTreasuryFee = newDaoFee;
                }
                if (newGasFee > gasPoolFee) {
                    gasPoolFee = newGasFee;
                }
            }
        }
        
        var totalFee = domTreasuryFee + daoTreasuryFee + gasPoolFee;
        var totalSpend = jettonAmount + totalFee;
        
        assert(balance >= totalSpend, ERROR_INSUFFICIENT_BALANCE);
        assert(msgValue >= MIN_TON_FOR_STORAGE, ERROR_INSUFFICIENT_GAS);
        
        balance -= totalSpend;
        saveData();
        
        // =====================================================
        // ОДНО СООБЩЕНИЕ НА GAS POOL
        // Gas Pool сделает всё остальное
        // =====================================================
        
        var gasPoolBody = beginCell()
            .storeUint(OP_GAS_POOL_EXECUTE, 32)
            .storeUint(queryId, 64)
            .storeCoins(jettonAmount)           // сколько получателю
            .storeSlice(toOwner)                // кому
            .storeSlice(ownerAddress)           // от кого (для возврата TON)
            .storeCoins(domTreasuryFee)         // налог DOM Treasury
            .storeCoins(daoTreasuryFee)         // налог DAO Treasury
            .storeCoins(gasPoolFee)             // комиссия Gas Pool
            .endCell();
        
        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeSlice(gasPoolAddress)
            .storeCoins(msgValue)               // весь TON на Gas Pool
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(gasPoolBody)
            .endCell();
        
        sendRawMessage(msg, 1);
        
        return;
    }
    
    // =====================================================
    // OP_BURN — сжечь токены (только owner)
    // =====================================================
    if (op == OP_BURN) {
        assert(
            senderAddress.equalSlices(ownerAddress),
            ERROR_NOT_OWNER
        );
        
        var burnAmount = msgBody.loadCoins();
        var responseDestination = msgBody.loadMsgAddress();
        
        assert(burnAmount > 0, ERROR_INVALID_AMOUNT);
        assert(balance >= burnAmount, ERROR_INSUFFICIENT_BALANCE);
        
        balance -= burnAmount;
        saveData();
        
        var body = beginCell()
            .storeUint(OP_BURN_NOTIFICATION, 32)
            .storeUint(queryId, 64)
            .storeCoins(burnAmount)
            .storeSlice(ownerAddress)
            .storeSlice(responseDestination)
            .endCell();
        
        var msg = beginCell()
            .storeUint(0x18, 6)
            .storeSlice(masterAddress)
            .storeCoins(msgValue)
            .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
            .storeRef(body)
            .endCell();
        
        sendRawMessage(msg, 1);
        
        return;
    }
    
    throw(0xffff);
}

// -----------------------------------------------------
// GETTERS
// -----------------------------------------------------

get fun getWalletData(): (int, slice, slice, slice) {
    loadData();
    
    return (
        balance,
        ownerAddress,
        masterAddress,
        gasPoolAddress
    );
}