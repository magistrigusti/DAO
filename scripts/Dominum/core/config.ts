import { Address } from '@ton/core';

export {
  DEPLOY_VALUES, DOM_METADATA, FIRST_MINT_AMOUNT, FIRST_MINT_CONFIG,
  FORWARDED_MESSAGE_WAIT_MS, METADATA_URL,
  MIN_GAS_POOL_BALANCE_FOR_FIRST_MINT,
  RECIPIENT_PLACEHOLDER_NAMESPACE,
} from './constants';

export type DomSignerAddresses = {
  master: Address; treasuryPool: Address; treasuryManager: Address;
  minter: Address; minterManager: Address; giverManager: Address;
};

export type DomDistributionAddresses = {
  frsAllodium: Address; allodiumFoundation: Address; defiMarket: Address;
  defiFoundry: Address; defiTreasury: Address; daoBank: Address;
  daoFoundation: Address; dominumBank: Address; dominumFoundation: Address;
};

export type DomPreGraphDistributionAddresses = Omit<
  DomDistributionAddresses,
  'dominumBank'
>;

export type DomRecipientOwnerAddresses = {
  frsOwner: Address; allodiumFoundationOwner: Address;
  marketOwner: Address; foundryOwner: Address;
  defiBankOwner: Address; daoBankOwner: Address;
  daoFoundationOwner: Address; dominumBankOwner: Address;
  dominumFoundationOwner: Address;
};

export type DomRecipientDependencies = {
  allodMaster: Address; defiFoundation: Address;
  foundryRelease: Address;
};

export type DomRecipientControls = DomRecipientOwnerAddresses &
DomRecipientDependencies & {
  ownerCodeHash: Buffer;
};

export type DomDeploymentAddresses = {
  deployer: Address; treasuryManager: Address; treasuryPool: Address;
  gasPool: Address; giverManager: Address; minterManager: Address;
  minter: Address; domMaster: Address; giverAllodium: Address;
  giverDefi: Address; giverDao: Address; giverDominum: Address;
};

function readAddress(name: string): Address {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return Address.parse(value);
}

function readHash(name: string): Buffer {
  const value = process.env[name];

  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 64-character hex hash`);
  }

  return Buffer.from(value, 'hex');
}

function requireUnique(
  addresses: Record<string, Address>,
  label: string
): void {
  const values = Object.values(addresses);
  const unique = new Set(
    values.map((address) => address.toRawString())
  );

  if (unique.size !== values.length) {
    throw new Error(`${label} addresses must be different`);
  }
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

  const signerValues = Object.values(signers);
  const signerKeys = Object.keys(signers);
  const uniqueAddresses = new Set(
    signerValues.map((address) => address.toRawString())
  );

  if (uniqueAddresses.size !== signerKeys.length) {
    throw new Error('DOM signer addresses must be different');
  }

  return signers;
}

export function loadDomDistributionAddresses(): DomDistributionAddresses {
  const distribution: DomDistributionAddresses = {
    frsAllodium: readAddress('DOM_RECIPIENT_ALLODIUM_FRS_ADDRESS'),
    allodiumFoundation:
      readAddress('DOM_RECIPIENT_ALLODIUM_FOUNDATION_ADDRESS'),
    defiMarket: readAddress('DOM_RECIPIENT_DEFI_MARKET_ADDRESS'),
    defiFoundry: readAddress('DOM_RECIPIENT_DEFI_FOUNDRY_ADDRESS'),
    defiTreasury: readAddress('DOM_RECIPIENT_DEFI_TREASURY_ADDRESS'),
    daoBank: readAddress('DOM_RECIPIENT_DAO_BANK_ADDRESS'),
    daoFoundation: readAddress('DOM_RECIPIENT_DAO_FOUNDATION_ADDRESS'),
    dominumBank: readAddress('DOM_RECIPIENT_DOMINUM_BANK_ADDRESS'),
    dominumFoundation:
      readAddress('DOM_RECIPIENT_DOMINUM_FOUNDATION_ADDRESS'),
  };

  requireUnique(distribution, 'DOM recipient');

  return distribution;
}

export function loadDomPreGraphDistributionAddresses():
DomPreGraphDistributionAddresses {
  const distribution: DomPreGraphDistributionAddresses = {
    frsAllodium: readAddress('DOM_RECIPIENT_ALLODIUM_FRS_ADDRESS'),
    allodiumFoundation:
      readAddress('DOM_RECIPIENT_ALLODIUM_FOUNDATION_ADDRESS'),
    defiMarket: readAddress('DOM_RECIPIENT_DEFI_MARKET_ADDRESS'),
    defiFoundry: readAddress('DOM_RECIPIENT_DEFI_FOUNDRY_ADDRESS'),
    defiTreasury: readAddress('DOM_RECIPIENT_DEFI_TREASURY_ADDRESS'),
    daoBank: readAddress('DOM_RECIPIENT_DAO_BANK_ADDRESS'),
    daoFoundation: readAddress('DOM_RECIPIENT_DAO_FOUNDATION_ADDRESS'),
    dominumFoundation:
      readAddress('DOM_RECIPIENT_DOMINUM_FOUNDATION_ADDRESS'),
  };

  requireUnique(distribution, 'DOM pre-graph recipient');
  return distribution;
}

export function loadDomRecipientOwnerAddresses():
DomRecipientOwnerAddresses {
  const owners: DomRecipientOwnerAddresses = {
    frsOwner: readAddress('DOM_RECIPIENT_ALLODIUM_FRS_OWNER_ADDRESS'),
    allodiumFoundationOwner: readAddress(
      'DOM_RECIPIENT_ALLODIUM_FOUNDATION_OWNER_ADDRESS'
    ),
    marketOwner: readAddress('DOM_RECIPIENT_DEFI_MARKET_OWNER_ADDRESS'),
    foundryOwner: readAddress('DOM_RECIPIENT_DEFI_FOUNDRY_OWNER_ADDRESS'),
    defiBankOwner: readAddress(
      'DOM_RECIPIENT_DEFI_TREASURY_OWNER_ADDRESS'
    ),
    daoBankOwner: readAddress('DOM_RECIPIENT_DAO_BANK_OWNER_ADDRESS'),
    daoFoundationOwner: readAddress(
      'DOM_RECIPIENT_DAO_FOUNDATION_OWNER_ADDRESS'
    ),
    dominumBankOwner: readAddress(
      'DOM_RECIPIENT_DOMINUM_BANK_OWNER_ADDRESS'
    ),
    dominumFoundationOwner: readAddress(
      'DOM_RECIPIENT_DOMINUM_FOUNDATION_OWNER_ADDRESS'
    ),
  };

  requireUnique(owners, 'DOM recipient owner');
  return owners;
}

export function loadDomRecipientDependencies():
DomRecipientDependencies {
  const dependencies: DomRecipientDependencies = {
    allodMaster: readAddress('ALLODIUM_MASTER_ADDRESS'),
    defiFoundation: readAddress('DEFI_FOUNDATION_ADDRESS'),
    foundryRelease: readAddress('DEFI_FOUNDRY_RELEASE_ADDRESS'),
  };

  requireUnique(dependencies, 'DOM recipient dependency');
  return dependencies;
}

export function loadDomRecipientControls(): DomRecipientControls {
  const owners = loadDomRecipientOwnerAddresses();
  const dependencies = loadDomRecipientDependencies();
  const controls: DomRecipientControls = {
    ...owners,
    ...dependencies,
    ownerCodeHash: readHash('DOM_RECIPIENT_OWNER_CODE_HASH'),
  };

  return controls;
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
