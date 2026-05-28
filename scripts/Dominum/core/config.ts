export const METADATA_URL =
  'https://raw.githubusercontent.com/magistrigusti/DAO/main/metadata/dom-metadata.json';

// Testnet: первый mint = 1_000_000 DOM.
// 1_000_000 * 10^6 = 1_000_000_000_000
export const FIRST_MINT_AMOUNT = 1_000_000_000_000n;

// Пауза нужна после manager -> contract forwarding,
// чтобы внутреннее сообщение успело дойти до целевого контракта.
export const FORWARDED_MESSAGE_WAIT_MS = 15_000;

export const DEPLOY_VALUES = {
  treasuryManager: '0.05',
  treasuryPool: '0.2',
  gasPool: '0.5',

  giverManager: '0.05',
  minterManager: '0.05',
  giver: '0.05',
  minter: '0.05',
  master: '0.05',

  roleConfig: '0.05',
  treasuryConfig: '0.05',
  gasPipeline: '0.08',
  mint: '0.35',
} as const;