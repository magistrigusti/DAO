import { Address } from '@ton/core';

export const FORWARDED_MESSAGE_WAIT_MS = 15_000;

export const ALLODIUM_PLACEHOLDER_NAMESPACE = 40;

export const ALLODIUM_METADATA_URL =
  'https://raw.githubusercontent.com/magistrigusti/DAO/' +
  'main/metadata/allod-metadata.json';

export const ALLODIUM_IMAGE_URL =
  'https://raw.githubusercontent.com/magistrigusti/DAO/' +
  'main/public/ALLOD.jpg';

export const ALLODIUM_METADATA = {
  name: 'Allodium V1 Test',
  symbol: 'tALLODV1',
  decimals: '4',
  description: 'Test token of the Allodium ecosystem',
  image: ALLODIUM_IMAGE_URL,
} as const;

export const ALLODIUM_DEFAULTS = {
  transferFeeAllod: 100n,
} as const;

export const ALLODIUM_DEPLOY_VALUES = {
  allodMaster: '0.05',
  allodGasPool: '0.5',
  allodGasPoolConfig: '0.05',
  allodGasPoolTopUp: '0.5',
  service: '0.05',
} as const;

export const ALLODIUM_PREFLIGHT = {
  emptyAmount: 0n,
  minimumGasPoolBalance: 500_000_000n,
} as const;

export type AllodiumBootstrapConfig = {
  masterOwner: Address;
  gasPoolAuthority: Address;
  metadataUrl: string;
};

export type AllodiumDeploymentAddresses = {
  allodMaster: Address;
  allodGasPool: Address;
  frsAllodium: Address;
};

function readAddress(name: string): Address {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return Address.parse(value);
}

function readHttpsUrl(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;

  if (!value) {
    throw new Error(`${name} is required`);
  }

  const url = new URL(value);

  if (url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS`);
  }

  return url.toString();
}

export function buildAllodiumPlaceholderAddress(
  target: number
): Address {
  const hash = Buffer.alloc(32);
  hash.writeUInt32BE(ALLODIUM_PLACEHOLDER_NAMESPACE, 0);
  hash.writeUInt32BE(target, 4);
  return new Address(0, hash);
}

export function loadAllodiumBootstrapConfig():
AllodiumBootstrapConfig {
  return {
    masterOwner: readAddress('ALLODIUM_MASTER_OWNER_ADDRESS'),
    gasPoolAuthority: readAddress(
      'ALLODIUM_GAS_POOL_AUTHORITY_ADDRESS'
    ),
    metadataUrl: readHttpsUrl(
      'ALLODIUM_METADATA_URL',
      ALLODIUM_METADATA_URL
    ),
  };
}

export function loadAllodiumDeploymentAddresses():
AllodiumDeploymentAddresses {
  const addresses = {
    allodMaster: readAddress('ALLODIUM_MASTER_ADDRESS'),
    allodGasPool: readAddress('ALLODIUM_GAS_POOL_ADDRESS'),
    frsAllodium: readAddress(
      'DOM_RECIPIENT_ALLODIUM_FRS_ADDRESS'
    ),
  };
  const unique = new Set(
    Object.values(addresses).map(
      (address) => address.toRawString()
    )
  );

  if (unique.size !== Object.keys(addresses).length) {
    throw new Error('Allodium deployment addresses must be different');
  }

  return addresses;
}
