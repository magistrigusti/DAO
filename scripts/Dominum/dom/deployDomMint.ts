import {
  Address,
} from '@ton/core';
import {
  NetworkProvider,
  UIProvider,
} from '@ton/blueprint';

import {
  loadDomDistributionAddresses,
  loadDomSignerAddresses,
} from '../core/config';

import { compileContracts } from './compileContracts';
import {
  deployInfrastructure,
} from '../foundation/deployInfrastructure';
import { deployTokenGraph } from './deployTokenGraph';

function writeAddress(
  ui: UIProvider,
  name: string,
  address: Address
): void {
  ui.write(
    `${name}=${address.toString()}`
  );
}

export async function run(
  provider: NetworkProvider
): Promise<void> {
  const ui = provider.ui();
  const sender = provider.sender();
  const deployer = sender.address;

  if (!deployer) {
    throw new Error(
      'Sender address is not available'
    );
  }

  ui.write(
    '========== DOM DEPLOY START =========='
  );

  writeAddress(
    ui,
    'DOM_DEPLOYER_ADDRESS',
    deployer
  );

  const signers =
    loadDomSignerAddresses();

  const distribution =
    loadDomDistributionAddresses();

  const compiled =
    await compileContracts(provider);

  const infrastructure =
    await deployInfrastructure(
      provider,
      compiled,
      deployer,
      signers
    );

  const graph =
    await deployTokenGraph(
      provider,
      compiled,
      infrastructure,
      signers,
      distribution
    );

  ui.write('');
  ui.write('DEPLOYED ADDRESS VARIABLES');

  writeAddress(
    ui,
    'DOM_TREASURY_MANAGER_ADDRESS',
    infrastructure.treasuryManager.address
  );

  writeAddress(
    ui,
    'DOM_TREASURY_POOL_ADDRESS',
    infrastructure.treasuryPool.address
  );

  writeAddress(
    ui,
    'DOM_GAS_POOL_ADDRESS',
    infrastructure.gasPool.address
  );

  writeAddress(
    ui,
    'DOM_GIVER_MANAGER_ADDRESS',
    graph.giverManager.address
  );

  writeAddress(
    ui,
    'DOM_MINTER_MANAGER_ADDRESS',
    graph.minterManager.address
  );

  writeAddress(
    ui,
    'DOM_MINTER_ADDRESS',
    graph.minter.address
  );

  writeAddress(
    ui,
    'DOM_MASTER_ADDRESS',
    graph.domMaster.address
  );

  writeAddress(
    ui,
    'DOM_GIVER_ALLODIUM_ADDRESS',
    graph.giverAllodium.address
  );

  writeAddress(
    ui,
    'DOM_GIVER_DEFI_ADDRESS',
    graph.giverDefi.address
  );

  writeAddress(
    ui,
    'DOM_GIVER_DAO_ADDRESS',
    graph.giverDao.address
  );

  writeAddress(
    ui,
    'DOM_GIVER_DOMINUM_ADDRESS',
    graph.giverDominum.address
  );

  ui.write('');
  ui.write(
    'Deployment completed without mint.'
  );

  ui.write(
    'Configure roles and GasPool next.'
  );

  ui.write(
    'Mint stays blocked until configuration passes.'
  );

  ui.write(
    '========== DOM DEPLOY END =========='
  );
}