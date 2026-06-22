import { Address } from '@ton/core';

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
  gasRouter: '0.1',

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

export type DomSignerAddresses = {
  master: Address;
  treasuryPool: Address;
  treasuryManager: Address;
  minter: Address;
  minterManager: Address;
  giverManager: Address;
};

function readSignerAddress(name: string): Address {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return Address.parse(value);
}

export function loadDomSignerAddresses(): DomSignerAddresses {
  const signers: DomSignerAddresses = {
    master: readSignerAddress('DOM_MASTER_SIGNER_ADDRESS'),
    treasuryPool: readSignerAddress('DOM_TREASURY_POOL_SIGNER_ADDRESS'),
    treasuryManager: readSignerAddress('DOM_TREASURY_MANAGER_SIGNER_ADDRESS'),
    minter: readSignerAddress('DOM_MINTER_SIGNER_ADDRESS'),
    minterManager: readSignerAddress('DOM_MINTER_MANAGER_SIGNER_ADDRESS'),
    giverManager: readSignerAddress('DOM_GIVER_MANAGER_SIGNER_ADDRESS'),
  };

  const uniqueAddresses = new Set(
    Object.values(signers).map((address) => address.toRawString())
  );

  if (uniqueAddresses.size !== Object.keys(signers).length) {
    throw new Error(
      'DOM signer addresses must be different for the two-key architecture'
    );
  }

  return signers;
}
