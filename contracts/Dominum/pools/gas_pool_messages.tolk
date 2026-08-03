import "gas_pool_storage.tolk";
import "../core/op_codes.tolk";
import "../core/constants.tolk";

fun gasPoolSendResponse(
    responseOp: int,
    routeId: int,
    value: int,
    sendMode: int
) {
    var body = beginCell()
        .storeUint(responseOp, 32)
        .storeUint(routeId, 64)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(treasuryPoolAddress)
        .storeCoins(value)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, sendMode);
}

fun gasPoolSendReady(routeId: int) {
    gasPoolSendResponse(
        OP_GAS_POOL_READY,
        routeId,
        PROTOCOL_GAS_BUDGET,
        1
    );
}

fun gasPoolSendReject(routeId: int) {
    gasPoolSendResponse(OP_GAS_POOL_REJECT, routeId, 0, 64);
}

fun gasPoolSendCommitted(routeId: int) {
    gasPoolSendResponse(OP_GAS_POOL_COMMITTED, routeId, 0, 64);
}

fun gasPoolSendDomFromPoolWallet(
    amount: int,
    queryId: int
) {
    var poolWallet = gasPoolWalletAddress(contract.getAddress());
    var body = beginCell()
        .storeUint(OP_PROTOCOL_TRANSFER, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeAddress(treasuryPoolAddress)
        .storeAddress(contract.getAddress())
        .storeCoins(GIVER_MAX_FEE_DOM)
        .endCell();
    var msg = beginCell()
        .storeUint(0x18, 6)
        .storeAddress(poolWallet)
        .storeCoins(MIN_GRAMS_FOR_TRANSFER)
        .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(body)
        .endCell();
    sendRawMessage(msg, 1);
}
