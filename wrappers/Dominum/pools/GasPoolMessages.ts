import {
  Address,
  beginCell,
  Cell,
} from '@ton/core';
import {
  OP_CHANGE_TAX,
  OP_GAS_POOL_COMMIT,
  OP_GAS_POOL_EXECUTE,
  OP_INIT_MASTER_CONFIG,
  OP_PROTOCOL_FINALIZE,
  OP_TOP_UP,
  OP_WITHDRAW_DOM,
} from '../core/op_code';

export function buildGasInitMasterBody(opts: {
  masterAddress: Address;
  jettonWalletCode: Cell;
  queryId?: bigint;
}): Cell {
  return beginCell()
    .storeUint(OP_INIT_MASTER_CONFIG, 32)
    .storeUint(opts.queryId ?? 0n, 64)
    .storeAddress(opts.masterAddress)
    .storeRef(opts.jettonWalletCode)
    .endCell();
}

export function buildGasExecuteBody(opts: {
  paidFeeDom: bigint;
  routeId?: bigint;
  queryId?: bigint;
}): Cell {
  return beginCell()
    .storeUint(OP_GAS_POOL_EXECUTE, 32)
    .storeUint(opts.routeId ?? opts.queryId ?? 0n, 64)
    .storeCoins(opts.paidFeeDom)
    .endCell();
}

export function buildGasCommitBody(routeId: bigint): Cell {
  return beginCell()
    .storeUint(OP_GAS_POOL_COMMIT, 32)
    .storeUint(routeId, 64)
    .endCell();
}

export function buildGasChangeTaxBody(opts: {
  newTaxMultiplier: number;
  queryId?: bigint;
}): Cell {
  return beginCell()
    .storeUint(OP_CHANGE_TAX, 32)
    .storeUint(opts.queryId ?? 0n, 64)
    .storeUint(opts.newTaxMultiplier, 16)
    .endCell();
}

export function buildGasTopUpBody(queryId = 0n): Cell {
  return beginCell()
    .storeUint(OP_TOP_UP, 32)
    .storeUint(queryId, 64)
    .endCell();
}

export function buildGasWithdrawDomBody(opts: {
  amount: bigint;
  queryId?: bigint;
}): Cell {
  return beginCell()
    .storeUint(OP_WITHDRAW_DOM, 32)
    .storeUint(opts.queryId ?? 0n, 64)
    .storeCoins(opts.amount)
    .endCell();
}

export function buildGasFinalizeBody(routeId: bigint): Cell {
  return beginCell()
    .storeUint(OP_PROTOCOL_FINALIZE, 32)
    .storeUint(routeId, 64)
    .storeUint(0n, 64)
    .endCell();
}
