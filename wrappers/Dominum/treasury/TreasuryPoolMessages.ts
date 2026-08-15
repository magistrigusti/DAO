import {
  Address,
  beginCell,
  Cell,
} from '@ton/core';
import {
  OP_CANCEL_TREASURY_REQUEST,
  OP_CHANGE_TAX,
  OP_CONFIRM_TREASURY_REQUEST,
  OP_GAS_POOL_COMMITTED,
  OP_GAS_POOL_READY,
  OP_GAS_POOL_REJECT,
  OP_INIT_MASTER_CONFIG,
  OP_INIT_TREASURY_WALLET_CONFIG,
  OP_PROTOCOL_DELIVERY_ACK,
  OP_PROTOCOL_RETRY,
  OP_PROTOCOL_SOURCE_ACK,
  OP_REFILL_POOL,
  OP_REPLACE_TREASURY_ADDRESS,
  OP_TREASURY_DELIVER,
  OP_TREASURY_EXECUTE,
  OP_WITHDRAW,
  OP_WITHDRAW_FROM_POOL,
  OP_WITHDRAW_JETTONS,
} from '../core/op_code';

function buildQueryBody(op: bigint, queryId = 0n): Cell {
  return beginCell()
    .storeUint(op, 32)
    .storeUint(queryId, 64)
    .endCell();
}

export function buildTreasuryInitMasterBody(opts: {
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

export function buildTreasuryWalletConfigBody(opts: {
  jettonWalletAddress: Address;
  queryId?: bigint;
}): Cell {
  return beginCell()
    .storeUint(OP_INIT_TREASURY_WALLET_CONFIG, 32)
    .storeUint(opts.queryId ?? 0n, 64)
    .storeAddress(opts.jettonWalletAddress)
    .endCell();
}

export function buildTreasuryAddressRequestBody(opts: {
  targetKind: number;
  oldAddress: Address;
  newAddress: Address;
  queryId?: bigint;
}): Cell {
  return beginCell()
    .storeUint(OP_REPLACE_TREASURY_ADDRESS, 32)
    .storeUint(opts.queryId ?? 0n, 64)
    .storeUint(opts.targetKind, 8)
    .storeAddress(opts.oldAddress)
    .storeAddress(opts.newAddress)
    .endCell();
}

export function buildTreasuryTaxRequestBody(opts: {
  oldTaxMultiplier: number;
  newTaxMultiplier: number;
  queryId?: bigint;
}): Cell {
  return beginCell()
    .storeUint(OP_CHANGE_TAX, 32)
    .storeUint(opts.queryId ?? 0n, 64)
    .storeUint(opts.oldTaxMultiplier, 16)
    .storeUint(opts.newTaxMultiplier, 16)
    .endCell();
}

export const buildTreasuryConfirmBody = (queryId = 0n) =>
  buildQueryBody(OP_CONFIRM_TREASURY_REQUEST, queryId);

export const buildTreasuryCancelBody = (queryId = 0n) =>
  buildQueryBody(OP_CANCEL_TREASURY_REQUEST, queryId);

export function buildTreasuryWithdrawBody(opts: {
  amount: bigint;
  toAddress: Address;
  queryId?: bigint;
  jettons?: boolean;
}): Cell {
  const op = opts.jettons ? OP_WITHDRAW_JETTONS : OP_WITHDRAW;
  return beginCell()
    .storeUint(op, 32)
    .storeUint(opts.queryId ?? 0n, 64)
    .storeCoins(opts.amount)
    .storeAddress(opts.toAddress)
    .endCell();
}

export function buildTreasuryAmountBody(opts: {
  amount: bigint;
  queryId?: bigint;
  withdraw?: boolean;
}): Cell {
  const op = opts.withdraw
    ? OP_WITHDRAW_FROM_POOL
    : OP_REFILL_POOL;
  return beginCell()
    .storeUint(op, 32)
    .storeUint(opts.queryId ?? 0n, 64)
    .storeCoins(opts.amount)
    .endCell();
}

export function buildTreasuryExecuteBody(opts: {
  jettonAmount: bigint;
  toOwner: Address;
  fromOwner: Address;
  paidFeeDom: bigint;
  queryId?: bigint;
}): Cell {
  return beginCell()
    .storeUint(OP_TREASURY_EXECUTE, 32)
    .storeUint(opts.queryId ?? 0n, 64)
    .storeCoins(opts.jettonAmount)
    .storeAddress(opts.toOwner)
    .storeAddress(opts.fromOwner)
    .storeCoins(opts.paidFeeDom)
    .endCell();
}

export const buildTreasuryRetryBody = (routeId: bigint) =>
  buildQueryBody(OP_PROTOCOL_RETRY, routeId);

export function buildGasResponseBody(opts: {
  routeId: bigint;
  kind: 'ready' | 'reject' | 'committed';
}): Cell {
  const op = opts.kind === 'ready'
    ? OP_GAS_POOL_READY
    : opts.kind === 'reject'
      ? OP_GAS_POOL_REJECT
      : OP_GAS_POOL_COMMITTED;
  return buildQueryBody(op, opts.routeId);
}

export function buildDeliveryAckBody(opts: {
  routeId: bigint;
  leg: number;
  amount: bigint;
  fromOwner: Address;
}): Cell {
  return beginCell()
    .storeUint(OP_PROTOCOL_DELIVERY_ACK, 32)
    .storeUint(opts.routeId, 64)
    .storeUint(opts.leg, 8)
    .storeCoins(opts.amount)
    .storeAddress(opts.fromOwner)
    .endCell();
}

export function buildSourceAckBody(opts: {
  routeId: bigint;
  sourceQueryId: bigint;
  success: boolean;
}): Cell {
  return beginCell()
    .storeUint(OP_PROTOCOL_SOURCE_ACK, 32)
    .storeUint(opts.routeId, 64)
    .storeUint(opts.sourceQueryId, 64)
    .storeBit(opts.success)
    .endCell();
}

export function buildLegacyDeliveryBody(opts: {
  queryId: bigint;
  walletAddress: Address;
  walletStateInit: Cell;
  walletBody: Cell;
}): Cell {
  return beginCell()
    .storeUint(OP_TREASURY_DELIVER, 32)
    .storeUint(opts.queryId, 64)
    .storeAddress(opts.walletAddress)
    .storeRef(opts.walletStateInit)
    .storeRef(opts.walletBody)
    .endCell();
}
