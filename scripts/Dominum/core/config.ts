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
  gasPool: '1',

  giverManager: '0.05',
  minterManager: '0.05',
  giver: '0.2',
  minter: '0.05',
  master: '0.05',

  roleConfig: '0.05',
  treasuryConfig: '0.05',
  gasPipeline: '0.08',
  mint: '0.35',
} as const;

// Девять protocol-transfer при первом mint резервируют по 0.1 TON в GasPool.
// Один дополнительный запас оставлен на storage, compute и forwarding fees.
export const MIN_GAS_POOL_BALANCE_FOR_FIRST_MINT = 1_000_000_000n;

export type DomSignerAddresses = {
  master: Address;
  treasuryPool: Address;
  treasuryManager: Address;
  minter: Address;
  minterManager: Address;
  giverManager: Address;
};

export type DomDistributionAddresses = {
  frsAllodium: Address;
  allodiumFoundation: Address;
  defiMarket: Address;
  defiFoundry: Address;
  defiTreasury: Address;
  daoBank: Address;
  daoFoundation: Address;
  dominumBank: Address;
  dominumFoundation: Address;
};

export type DomDeploymentAddresses = {
  deployer: Address;
  treasuryManager: Address;
  treasuryPool: Address;
  gasPool: Address;
  giverManager: Address;
  minterManager: Address;
  minter: Address;
  domMaster: Address;
  giverAllodium: Address;
  giverDefi: Address;
  giverDao: Address;
  giverDominum: Address;
};

function readAddress(name: string): Address {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return Address.parse(value);
}

export function loadDomSignerAddresses(): DomSignerAddresses {
  const signers: DomSignerAddresses = {
    master: readAddress('DOM_MASTER_SIGNER_ADDRESS'),
    treasuryPool: readAddress('DOM_TREASURY_POOL_SIGNER_ADDRESS'),
    treasuryManager: readAddress('DOM_TREASURY_MANAGER_SIGNER_ADDRESS'),
    minter: readAddress('DOM_MINTER_SIGNER_ADDRESS'),
    minterManager: readAddress('DOM_MINTER_MANAGER_SIGNER_ADDRESS'),
    giverManager: readAddress('DOM_GIVER_MANAGER_SIGNER_ADDRESS'),
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

export function loadDomDistributionAddresses(): DomDistributionAddresses {
  return {
    frsAllodium: readAddress('DOM_RECIPIENT_ALLODIUM_FRS_ADDRESS'),
    allodiumFoundation: readAddress('DOM_RECIPIENT_ALLODIUM_FOUNDATION_ADDRESS'),
    defiMarket: readAddress('DOM_RECIPIENT_DEFI_MARKET_ADDRESS'),
    defiFoundry: readAddress('DOM_RECIPIENT_DEFI_FOUNDRY_ADDRESS'),
    defiTreasury: readAddress('DOM_RECIPIENT_DEFI_TREASURY_ADDRESS'),
    daoBank: readAddress('DOM_RECIPIENT_DAO_BANK_ADDRESS'),
    daoFoundation: readAddress('DOM_RECIPIENT_DAO_FOUNDATION_ADDRESS'),
    dominumBank: readAddress('DOM_RECIPIENT_DOMINUM_BANK_ADDRESS'),
    dominumFoundation: readAddress('DOM_RECIPIENT_DOMINUM_FOUNDATION_ADDRESS'),
  };
}

export function loadDomDeploymentAddresses(): DomDeploymentAddresses {
  return {
    deployer: readAddress('DOM_DEPLOYER_ADDRESS'),
    treasuryManager: readAddress('DOM_TREASURY_MANAGER_ADDRESS'),
    treasuryPool: readAddress('DOM_TREASURY_POOL_ADDRESS'),
    gasPool: readAddress('DOM_GAS_POOL_ADDRESS'),
    giverManager: readAddress('DOM_GIVER_MANAGER_ADDRESS'),
    minterManager: readAddress('DOM_MINTER_MANAGER_ADDRESS'),
    minter: readAddress('DOM_MINTER_ADDRESS'),
    domMaster: readAddress('DOM_MASTER_ADDRESS'),
    giverAllodium: readAddress('DOM_GIVER_ALLODIUM_ADDRESS'),
    giverDefi: readAddress('DOM_GIVER_DEFI_ADDRESS'),
    giverDao: readAddress('DOM_GIVER_DAO_ADDRESS'),
    giverDominum: readAddress('DOM_GIVER_DOMINUM_ADDRESS'),
  };
}
