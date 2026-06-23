import { toNano } from '@ton/core';

export const DOM_COMPILE = {
  master: 'Dominum/dom/DomMaster',
  wallet: 'Dominum/dom/DomWallet',

  minter: 'Dominum/treasury/Minter',
  treasuryPool: 'Dominum/treasury/TreasuryPool',
  treasuryManager: 'Dominum/management/TreasuryManager',

  gasPool: 'Dominum/pools/GasPool',

  minterManager: 'Dominum/management/MinterManager',
  giverManager: 'Dominum/management/GiverManager',

  giverAllodium: 'Dominum/givers/GiverAllodium',
  giverDefi: 'Dominum/givers/GiverDefi',
  giverDao: 'Dominum/givers/GiverDao',
  giverDominum: 'Dominum/givers/GiverDominum',

  bankDao: 'Dominum/banks/BankDao',
  bankDefi: 'Dominum/banks/BankDefi',
  bankDominum: 'Dominum/banks/BankDominum',

  daoFoundation: 'Dominum/dao/DaoFoundation',
  dominumFoundation: 'Dominum/foundation/DominumFoundation',

  marketMaker: 'Dominum/defi/MarketMaker',
  foundryLock: 'Dominum/invest/FoundryLock',
} as const;

export const DOM_STATE = {
  emptySupply: 0n,
  emptyBalance: 0n,
  emptyCounter: 0n,
  noLastMintTime: 0n,
  zeroCoins: 0n,
  zeroCount: 0n,
  oneCount: 1n,
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

  giverMaxFeeDom: 1_500_000n,

  minDomTransferFee: 1_000_000n,
  maxDomTransferFee: 3_000_000n,
  domTransferTonBase: 50_000_000n,
  initialDomPerTon: 10_000_000n,
  nanoTon: 1_000_000_000n,
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
  masterMint: 11n,
  directMintRejected: 12n,

  walletTransfer: 21n,
  walletRejectedTransfer: 22n,
  walletBurn: 23n,

  replaceMinter: 31n,
  replaceMinterRejected: 32n,
  replaceMinterManager: 33n,

  replaceGiverAllodium: 41n,
  replaceGiverDefi: 42n,
  replaceGiverDao: 43n,
  replaceGiverDominum: 44n,
  replaceGiverRejected: 45n,
  replaceGiverManager: 46n,

  treasuryWalletInit: 51n,
  treasuryWalletInitRejected: 52n,
  treasuryAddressRequest: 53n,
  treasuryAddressConfirm: 54n,
  treasuryAddressRejected: 55n,

  gasInitMaster: 61n,
  gasInitMasterRejected: 62n,
  gasTransfer: 63n,

  minterMint: 71n,
  minterMintRejected: 72n,

  bankCommand: 81n,

  e2eMint: 101n,
} as const;

export function calculateShare(
  amount: bigint,
  sharePercent: bigint
): bigint {
  return amount * sharePercent / 100n;
}

export function calculateDefaultDomFee(): bigint {
  const feeDom = DOM_CONTRACT.domTransferTonBase *
    DOM_CONTRACT.initialDomPerTon *
    DOM_CONTRACT.taxMultiplier /
    DOM_CONTRACT.nanoTon /
    DOM_CONTRACT.taxMultiplierDenom;

  if (feeDom < DOM_CONTRACT.minDomTransferFee) {
    return DOM_CONTRACT.minDomTransferFee;
  }

  if (feeDom > DOM_CONTRACT.maxDomTransferFee) {
    return DOM_CONTRACT.maxDomTransferFee;
  }

  return feeDom;
}

export function calculateGiverReserve(
  transferCount: bigint
): bigint {
  return DOM_CONTRACT.giverMaxFeeDom * transferCount;
}

export function calculateFirstMintGasPoolFee(): bigint {
  return calculateGiverReserve(9n);
}

export function calculateFirstMintSingleRecipientAmount(): bigint {
  const allodiumGross = calculateShare(
    DOM_FIXTURE.firstMintAmount,
    DOM_CONTRACT.shareAllodium
  );

  const defiGross = calculateShare(
    DOM_FIXTURE.firstMintAmount,
    DOM_CONTRACT.shareDefi
  );

  const daoGross = calculateShare(
    DOM_FIXTURE.firstMintAmount,
    DOM_CONTRACT.shareDao
  );

  const dominumGross =
    DOM_FIXTURE.firstMintAmount -
    allodiumGross -
    defiGross -
    daoGross;

  return allodiumGross -
    calculateGiverReserve(2n) +
    defiGross -
    calculateGiverReserve(3n) +
    daoGross -
    calculateGiverReserve(2n) +
    dominumGross -
    calculateGiverReserve(2n);
}
