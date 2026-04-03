import {
  Address,
  toNano,
} from '@ton/core';
import {
  NetworkProvider,
} from '@ton/blueprint';

import { DEPLOY_VALUES } from '../core/config';
import { CompiledContracts } from '../core/types';

import {
  GiverManager,
} from '../../../wrappers/Dominum/management/GiverManager';

export async function deployGiverManager(
  provider: NetworkProvider,
  compiled: CompiledContracts,
  deployer: Address
) {
  const ui = provider.ui();
  const sender = provider.sender();

  ui.write('--- Step 3: Deploy GiverManager ---');

  const giverManager = provider.open(
      GiverManager.createFromConfig(
          {
              ownerAddress: deployer,
          },
          compiled.giverManagerCode
      )
  );

  await giverManager.sendDeploy(
      sender,
      toNano(DEPLOY_VALUES.giverManager)
  );

  await provider.waitForDeploy(
      giverManager.address
  );

  ui.write(
      `GiverManager: ${giverManager.address.toString()}`
  );

  return giverManager;
}