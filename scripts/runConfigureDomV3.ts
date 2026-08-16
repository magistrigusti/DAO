import { Address } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { DomMaster } from '../wrappers/Dominum/dom/DomMaster';
import { GasPool } from '../wrappers/Dominum/pools/GasPool';
import { TreasuryPool } from '../wrappers/Dominum/treasury/TreasuryPool';
import { Minter } from '../wrappers/Dominum/treasury/Minter';
import {
  TreasuryManager,
} from '../wrappers/Dominum/management/TreasuryManager';
import {
  MinterManager,
} from '../wrappers/Dominum/management/MinterManager';
import {
  GiverManager,
} from '../wrappers/Dominum/management/GiverManager';
import { GiverAllodium } from '../wrappers/Dominum/givers/GiverAllodium';
import { GiverDefi } from '../wrappers/Dominum/givers/GiverDefi';
import { GiverDao } from '../wrappers/Dominum/givers/GiverDao';
import { GiverDominum } from '../wrappers/Dominum/givers/GiverDominum';
import {
  GIVER_TARGET,
  TREASURY_TARGET,
} from '../wrappers/Dominum/core/constants';
import {
  FORWARDED_MESSAGE_WAIT_MS,
  loadDomDeploymentAddresses,
  loadDomDistributionAddresses,
} from './Dominum/core/config';
import { sleep } from './Dominum/core/helpers';
import {
  InfrastructureContracts,
  TokenGraphContracts,
} from './Dominum/core/types';
import { compileContracts } from './Dominum/dom/compileContracts';
import {
  confirmCurrentMasterRequest,
  requestInitialGiver,
  requestInitialMinter,
} from './Dominum/management/configureTokenGraph';
import {
  confirmGasPoolReplacement,
  initializeGasPipeline,
  requestGasPoolReplacement,
} from './Dominum/treasury/configureGasPipeline';
import {
  confirmTreasuryTargetReplacement,
  requestTreasuryTargetReplacement,
} from './Dominum/treasury/configureTreasuryTargets';
import { createDomProvider } from './runtime/toncenter-v3/DomProvider';

type Contracts = {
  infrastructure: InfrastructureContracts;
  graph: TokenGraphContracts;
};

type StatusCheck = { label: string; valid: boolean };

function same(actual: Address, expected: Address): boolean {
  return actual.equals(expected);
}

function openContracts(provider: NetworkProvider): Contracts {
  const addresses = loadDomDeploymentAddresses();
  return {
    infrastructure: {
      deployer: addresses.deployer,
      treasuryManager: provider.open(
        TreasuryManager.createFromAddress(addresses.treasuryManager)
      ),
      treasuryPool: provider.open(
        TreasuryPool.createFromAddress(addresses.treasuryPool)
      ),
      gasPool: provider.open(GasPool.createFromAddress(addresses.gasPool)),
    },
    graph: {
      giverManager: provider.open(
        GiverManager.createFromAddress(addresses.giverManager)
      ),
      minterManager: provider.open(
        MinterManager.createFromAddress(addresses.minterManager)
      ),
      minter: provider.open(Minter.createFromAddress(addresses.minter)),
      domMaster: provider.open(
        DomMaster.createFromAddress(addresses.domMaster)
      ),
      giverAllodium: provider.open(
        GiverAllodium.createFromAddress(addresses.giverAllodium)
      ),
      giverDefi: provider.open(
        GiverDefi.createFromAddress(addresses.giverDefi)
      ),
      giverDao: provider.open(
        GiverDao.createFromAddress(addresses.giverDao)
      ),
      giverDominum: provider.open(
        GiverDominum.createFromAddress(addresses.giverDominum)
      ),
    },
  };
}

async function printStatus(
  provider: NetworkProvider,
  contracts: Contracts
): Promise<void> {
  const { infrastructure, graph } = contracts;
  const distribution = loadDomDistributionAddresses();
  const [master, pending, givers, gas, treasury, treasuryPending, minter] =
    await Promise.all([
      graph.domMaster.getMasterData(),
      graph.domMaster.getMasterPendingRequest(),
      graph.domMaster.getGiversData(),
      infrastructure.gasPool.getGasPoolData(),
      infrastructure.treasuryPool.getTreasuryPoolData(),
      infrastructure.treasuryPool.getTreasuryPendingData(),
      graph.minter.getMinterData(),
    ]);
  const checks: StatusCheck[] = [
    { label: 'Minter role', valid: same(
      master.minterAddress, graph.minter.address
    ) },
    { label: 'Minter master', valid: same(
      minter.masterAddress, graph.domMaster.address
    ) },
    { label: 'GiverAllodium role', valid: same(
      givers.giverAllodiumAddress, graph.giverAllodium.address
    ) },
    { label: 'GiverDefi role', valid: same(
      givers.giverDefiAddress, graph.giverDefi.address
    ) },
    { label: 'GiverDao role', valid: same(
      givers.giverDaoAddress, graph.giverDao.address
    ) },
    { label: 'GiverDominum role', valid: same(
      givers.giverDominumAddress, graph.giverDominum.address
    ) },
    { label: 'Master request empty', valid: !pending.hasPending },
    {
      label: 'Treasury request empty',
      valid: !treasuryPending.hasPending,
    },
    { label: 'Treasury GasPool', valid: same(
      treasury.gasPoolAddress, infrastructure.gasPool.address
    ) },
    { label: 'Treasury DAO Bank', valid: same(
      treasury.bankDaoAddress, distribution.daoBank
    ) },
    { label: 'Treasury DeFi Bank', valid: same(
      treasury.bankDefiAddress, distribution.defiTreasury
    ) },
    { label: 'Treasury Dominum Bank', valid: same(
      treasury.bankDominumAddress, distribution.dominumBank
    ) },
    { label: 'GasPool configured', valid: gas.masterConfigured },
    { label: 'GasPool master', valid: same(
      gas.masterAddress, graph.domMaster.address
    ) },
    { label: 'Treasury wallet', valid: treasury.walletConfigured },
  ];

  checks.forEach((check) => provider.ui().write(
    `${check.label}: ${check.valid ? 'OK' : 'NO'}`
  ));

  if (!checks.every((check) => check.valid)) {
    throw new Error('DOM core configuration is incomplete');
  }
}

async function requestGiverAction(
  provider: NetworkProvider,
  graph: TokenGraphContracts,
  action: string
): Promise<boolean> {
  const targets: Record<string, [number, bigint]> = {
    'giver-allodium-request': [GIVER_TARGET.allodium, 41n],
    'giver-defi-request': [GIVER_TARGET.defi, 42n],
    'giver-dao-request': [GIVER_TARGET.dao, 43n],
    'giver-dominum-request': [GIVER_TARGET.dominum, 44n],
  };
  const target = targets[action];

  if (!target) {
    return false;
  }

  await requestInitialGiver(provider, graph, target[0], target[1]);
  await provider.waitForLastTransaction();
  await sleep(FORWARDED_MESSAGE_WAIT_MS);
  return true;
}

async function requestTreasuryAction(
  provider: NetworkProvider,
  contracts: Contracts,
  action: string
): Promise<boolean> {
  const distribution = loadDomDistributionAddresses();
  const targets: Record<string, [number, Address, bigint]> = {
    'bank-dao-request': [TREASURY_TARGET.bankDao, distribution.daoBank, 47n],
    'bank-defi-request': [
      TREASURY_TARGET.bankDefi, distribution.defiTreasury, 48n,
    ],
    'bank-dominum-request': [
      TREASURY_TARGET.bankDominum, distribution.dominumBank, 49n,
    ],
  };
  const target = targets[action];

  if (!target) {
    return false;
  }

  await requestTreasuryTargetReplacement(
    provider,
    contracts.infrastructure,
    target[0],
    target[1],
    target[2]
  );
  await sleep(FORWARDED_MESSAGE_WAIT_MS);
  return true;
}

async function runAction(
  provider: NetworkProvider,
  action: string
): Promise<void> {
  const contracts = openContracts(provider);
  const { infrastructure, graph } = contracts;

  if (action === 'status') {
    await printStatus(provider, contracts);
  } else if (action === 'minter-request') {
    await requestInitialMinter(provider, graph);
    await provider.waitForLastTransaction();
    await sleep(FORWARDED_MESSAGE_WAIT_MS);
  } else if (await requestGiverAction(provider, graph, action)) {
    return;
  } else if (action === 'master-confirm') {
    await confirmCurrentMasterRequest(provider, graph, 45n);
    await provider.waitForLastTransaction();
  } else if (await requestTreasuryAction(provider, contracts, action)) {
    return;
  } else if (action === 'treasury-confirm') {
    await confirmTreasuryTargetReplacement(provider, infrastructure, 50n);
  } else if (action === 'gas-pool-request') {
    await requestGasPoolReplacement(provider, infrastructure);
  } else if (action === 'gas-pool-confirm') {
    await confirmGasPoolReplacement(provider, infrastructure);
  } else if (action === 'gas-pipeline-init') {
    const compiled = await compileContracts(provider);
    await initializeGasPipeline(
      provider,
      compiled,
      infrastructure,
      graph
    );
  } else {
    throw new Error(`Unknown DOM_CONFIG_ACTION: ${action}`);
  }
}

async function main(): Promise<void> {
  const provider = await createDomProvider();
  const action = process.env.DOM_CONFIG_ACTION ?? 'status';
  provider.ui().write(`DOM_CONFIG_ACTION=${action}`);
  await runAction(provider, action);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
