
const DEFAULT_DOM_PER_TON = 10_000_000n;
const DEFAULT_BASE_TON_COST = 50_000_000n;
const DEFAULT_TAX_MULTIPLIER = 300;
const DEFAULT_MESSAGE_TON_AMOUNT = 10_000_000n;

export const TREASURY_TARGET = {
  bankDao: 1,
  bankDefi: 2,
  bankDominum: 3,
  gasPool: 4,
} as const;

export const GIVER_TARGET = {
  allodium: 1,
  defi: 2,
  dao: 3,
  dominum: 4,
} as const;

export const MASTER_REQUEST = {
  none: 0n,
  minter: 1n,
  giver: 2n,
  minterManager: 3n,
  giverManager: 4n,
} as const;

export const MANAGER_TARGET = {
  minter: 1,
  giver: 2,
} as const;

export const PROTOCOL_LEG = {
  recipient: 0,
  fee: 1,
} as const;

export const PROTOCOL_ACK = {
  recipient: 1,
  fee: 2,
  all: 3,
} as const;

export const PROTOCOL_ROUTE_STATE = {
  waitGas: 1,
  delivering: 2,
  waitCommit: 3,
  waitSourceAck: 4,
} as const;

export const PROTOCOL_EXECUTION_STATE = {
  ready: 1,
  committed: 2,
} as const;
