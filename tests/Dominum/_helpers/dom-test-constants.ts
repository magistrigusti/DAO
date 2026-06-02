import { toNano } from '@ton/core';

export const DOM_COMPILE = {
  wallet: 'Dominum/dom/DomWallet',
  master: 'Dominum/dom/DomMaster',

  minter: 'Dominum/treasury/Minter',
  treasuryPool: 'Dominum/treasury/TreasuryPool',
  treasuryManager: 'Dominum/treasury/TreasuryManager',

  gasPool: 'Dominum/pools/GasPool',

  minterManager: 'Dominum/management/MinterManager',
  giverManager: 'Dominum/givers/GiverManager',

  giverAllodium: 'Dominum/givers/GiverAllodium',
  giverDefi: 'Dominum/givers/GiverDefi',
  giverDao: 'Dominum/givers/GiverDao',
  giverDominum: 'Dominum/givers/GiverDominum',

  bankDao: 'Dominum/banks/BankDao',
  bankDefi: 'Dominum/banks/BankDefi',
  bankDominum: 'Dominum/banks/BankDominum',
} as const;

export const DOM_STATE = {
  emptySupply: 0n,
  emptyBalance: 0n,
  emptyCounter: 0n,
  noLastMintTime: 0n,

  notStarted: false,
  walletNotConfigured: false,
  masterNotConfigured: false,
} as const;

export const DOM_CONTRACT = {
  oneDom: 1_000_000n,

  minMintAmount: 1_000_000n,
  maxMintAmount: 1_000_000_000_000n,
  mintInterval: 3_600n,

  shareAllodium: 25n,
  shareDefi: 25n,
  shareDao: 25n,
  shareDominum: 25n,

  giverMaxFeeDom: 3_000_000n,

  minDomTransferFee: 1_000_000n,
  taxMultiplier: 300n,
  taxMultiplierDenom: 100n,

  pendingAddressKind: 1n,
} as const;

export const DOM_FIXTURE = {
  firstMintAmount: DOM_CONTRACT.maxMintAmount,

  walletInitialBalance: DOM_CONTRACT.oneDom * 1_000n,
  walletTransferAmount: DOM_CONTRACT.oneDom * 100n,
  walletSmallTransferAmount: DOM_CONTRACT.oneDom * 50n,
} as const;

export const DOM_VALUE = {
  deploySmall: toNano('0.05'),
  deployTreasuryPool: toNano('0.2'),
  deployGasPool: toNano('1'),
  config: toNano('0.05'),
  gasPipeline: toNano('0.08'),
  mint: toNano('0.35'),
} as const;

export const DOM_QUERY = {
  walletTransfer: 21n,
  walletRejectedTransfer: 22n,
  walletBurn: 23n,

  gasInitMaster: 61n,
  gasInitMasterRejected: 62n,
  gasTransfer: 63n,
} as const;

export function calculateDefaultDomFee(): bigint {
  return DOM_CONTRACT.minDomTransferFee *
    DOM_CONTRACT.taxMultiplier /
    DOM_CONTRACT.taxMultiplierDenom;
}