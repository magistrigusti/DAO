import {
  Address,
  beginCell,
  Cell,
} from '@ton/core';
import {
  OP_BURN,
  OP_CLEAR_PENDING_TRANSFER,
  OP_INTERNAL_TRANSFER,
  OP_PROTOCOL_DELIVERY,
  OP_PROTOCOL_FINALIZE,
  OP_PROTOCOL_TRANSFER,
  OP_TREASURY_FAILED,
  OP_TREASURY_SETTLE,
  OP_TRANSFER,
} from '../core/op_code';

export type DomTransferOptions = {
  amount: bigint;
  destination: Address;
  responseDestination?: Address | null;
  customPayload?: Cell | null;
  forwardTonAmount?: bigint;
  forwardPayload?: Cell | null;
  queryId?: bigint;
};

export function buildDomTransferBody(
  opts: DomTransferOptions
): Cell {
  const body = beginCell()
    .storeUint(OP_TRANSFER, 32)
    .storeUint(opts.queryId ?? 0n, 64)
    .storeCoins(opts.amount)
    .storeAddress(opts.destination)
    .storeAddress(opts.responseDestination ?? null)
    .storeMaybeRef(opts.customPayload ?? null)
    .storeCoins(opts.forwardTonAmount ?? 0n);
  if (opts.forwardPayload) {
    body.storeBit(true).storeRef(opts.forwardPayload);
  } else {
    body.storeBit(false);
  }
  return body.endCell();
}

export type DomProtocolTransferOptions = {
  jettonAmount: bigint;
  toOwner: Address;
  paidFeeDom?: bigint;
  maxFeeDom?: bigint;
  responseDestination?: Address | null;
  queryId?: bigint;
};

export function buildDomProtocolTransferBody(
  opts: DomProtocolTransferOptions
): Cell {
  const paidFeeDom = opts.paidFeeDom ?? opts.maxFeeDom;
  if (paidFeeDom === undefined) {
    throw new Error('paidFeeDom is required');
  }
  return beginCell()
    .storeUint(OP_PROTOCOL_TRANSFER, 32)
    .storeUint(opts.queryId ?? 0n, 64)
    .storeCoins(opts.jettonAmount)
    .storeAddress(opts.toOwner)
    .storeAddress(opts.responseDestination ?? null)
    .storeCoins(paidFeeDom)
    .endCell();
}

export type DomInternalTransferOptions = {
  amount: bigint;
  fromOwner: Address;
  responseDestination?: Address | null;
  forwardTonAmount?: bigint;
  forwardPayload?: Cell | null;
  queryId?: bigint;
};

export function buildDomInternalTransferBody(
  opts: DomInternalTransferOptions
): Cell {
  const body = beginCell()
    .storeUint(OP_INTERNAL_TRANSFER, 32)
    .storeUint(opts.queryId ?? 0n, 64)
    .storeCoins(opts.amount)
    .storeAddress(opts.fromOwner)
    .storeAddress(opts.responseDestination ?? null)
    .storeCoins(opts.forwardTonAmount ?? 0n);
  if (opts.forwardPayload) {
    body.storeBit(true).storeRef(opts.forwardPayload);
  } else {
    body.storeBit(false);
  }
  return body.endCell();
}

export function buildDomBurnBody(opts: {
  amount: bigint;
  responseDestination?: Address | null;
  customPayload?: Cell | null;
  queryId?: bigint;
}): Cell {
  return beginCell()
    .storeUint(OP_BURN, 32)
    .storeUint(opts.queryId ?? 0n, 64)
    .storeCoins(opts.amount)
    .storeAddress(opts.responseDestination ?? null)
    .storeMaybeRef(opts.customPayload ?? null)
    .endCell();
}

export function buildClearPendingBody(queryId: bigint): Cell {
  return beginCell()
    .storeUint(OP_CLEAR_PENDING_TRANSFER, 32)
    .storeUint(queryId, 64)
    .endCell();
}

export function buildProtocolDeliveryBody(opts: {
  routeId: bigint;
  leg: number;
  amount: bigint;
  fromOwner: Address;
}): Cell {
  return beginCell()
    .storeUint(OP_PROTOCOL_DELIVERY, 32)
    .storeUint(opts.routeId, 64)
    .storeUint(opts.leg, 8)
    .storeCoins(opts.amount)
    .storeAddress(opts.fromOwner)
    .endCell();
}

export function buildProtocolFinalizeBody(opts: {
  routeId: bigint;
  sourceQueryId: bigint;
}): Cell {
  return beginCell()
    .storeUint(OP_PROTOCOL_FINALIZE, 32)
    .storeUint(opts.routeId, 64)
    .storeUint(opts.sourceQueryId, 64)
    .endCell();
}

export function buildProtocolSourceResultBody(opts: {
  routeId: bigint;
  sourceQueryId: bigint;
  success: boolean;
}): Cell {
  const op = opts.success
    ? OP_TREASURY_SETTLE
    : OP_TREASURY_FAILED;
  return beginCell()
    .storeUint(op, 32)
    .storeUint(opts.routeId, 64)
    .storeUint(opts.sourceQueryId, 64)
    .endCell();
}
