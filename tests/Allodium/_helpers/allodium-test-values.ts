import { toNano } from '@ton/core';

export const ALLODIUM_COMPILE = {
  master: 'Allodium/allod/AllodMaster',
  wallet: 'Allodium/allod/AllodWallet',
  frsAllodium: 'Allodium/treasury/FrsAllodium',
  foundation: 'Allodium/foundation/AllodiumFoundation',
} as const;

export const ALLODIUM_STATE = {
  emptySupply: 0n,
  emptyBalance: 0n,
  emptyAllowance: 0n,
  emptyLockedDom: 0n,
  emptyCounter: 0n,
} as const;

export const ALLODIUM_CONTRACT = {
  oneDom: 1_000_000n,
  oneAllod: 10_000n,
  exchangeRateDomToAllod: 100n,
  exchangeDecimalsFactor: 100n,
  taxAllodTon: toNano('0.01'),
} as const;

export const ALLODIUM_FIXTURE = {
  lockedDomAmount: 1_000_000n,
  mintAllowance: 1_000_000n,
  mintAmount: 500_000n,
  walletInitialBalance: 1_000_000n,
  walletTransferAmount: 250_000n,
} as const;

export const ALLODIUM_VALUE = {
  deploySmall: toNano('0.05'),
  deployMedium: toNano('0.1'),
  transferWithTax: toNano('0.05'),
  service: toNano('0.05'),
} as const;

export const ALLODIUM_QUERY = {
  increaseAllowance: 11n,
  mint: 12n,
  walletFund: 13n,
  walletTransfer: 14n,
  walletBurn: 15n,
  domLocked: 21n,
  allodBurned: 22n,
  withdraw: 31n,
  addWhitelist: 32n,
  removeWhitelist: 33n,
  rejected: 99n,
} as const;

export function calculateAllodFromDom(domAmount: bigint): bigint {
  return domAmount *
    ALLODIUM_CONTRACT.exchangeRateDomToAllod /
    ALLODIUM_CONTRACT.exchangeDecimalsFactor;
}
