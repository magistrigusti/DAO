export const FORWARDED_MESSAGE_WAIT_MS = 15_000;

export const ALLODIUM_DEFAULTS = {
  transferFeeAllod: 100n,
} as const;

export const ALLODIUM_DEPLOY_VALUES = {
  allodGasPool: '0.5',
  allodGasPoolConfig: '0.05',
  allodGasPoolTopUp: '0.5',
  service: '0.05',
} as const;