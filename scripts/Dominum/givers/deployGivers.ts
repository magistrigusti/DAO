import {
  Address,
  toNano,
} from '@ton/core';
import {
  NetworkProvider,
} from '@ton/blueprint';
import {
  DEPLOY_VALUES,
  METADATA_URL,
} from '../core/config';
import { buildOffChainContent } from '../core/helpers';
import {
  CompiledContracts,
  InfrastructureContracts,
  TokenGraphContracts,
} from '../core/types';
import { DomMaster } from '../../../wrappers/Dominum/dom/DomMaster';
import {
  GiverAllodium,
} from '../../../wrappers/Dominum/givers/GiverAllodium';
import {
  GiverDefi,
} from '../../../wrappers/Dominum/givers/GiverDefi';
import {
  GiverDao,
} from '../../../wrappers/Dominum/givers/GiverDao';
import {
  GiverDominum,
} from '../../../wrappers/Dominum/givers/GiverDominum';
import {
  GiverManager,
} from '../../../wrappers/Dominum/management/GiverManager';

export async function deployGivers(
  provider: NetworkProvider,
  compiled: CompiledContracts,
  infrastructure: InfrastructureContracts,
  deployer: Address
): Provise<TokenGraphContracts> {
  const ui = provider.ui();
  const sender = provider.sender();

  ui.write('Step 3: Deploy GiverManager');

  const giverManager = provider.open(
    GiverManager.createFromConfig(
      { ownerAddress: deployer },
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
  ui.write(`GiverManager ${giverManager.address.toString()}`);

  ui.write('Step 4: Deploy Givers');

  const giverAllodium = provider.open(
    GiverAllodium.createFromConfig(
      {
        managerAddress: giverManager.address,
        frsAllodiumAddress: deployer,
        allodiumFoundationAddress: deployer,
      },
      compiled.giverAllodiumCode
    )
  );

  await giverAllodium.sendDeploy(
    sender,
    toNano(DEPLOY_VALUES.giver)
  );
  await provider.waitForDeploy(
    giverAllodium.address
  );

  ui.write(`GiverAllodium: ${giverAllodium.address.toString()}`);

  const giverDefi = provider.open(
    GiverDefi.createFromConfig(
      {
        managerAddress: giverManager.address,
        defiBankAddress: deployer,
        defiDualAddress: deployer,
      },
      compiled.giverDefiCode
    )
  );

  await giverDefi.sendDeploy(
    sender,
    toNano(DEPLOY_VALUES.giver)
  );
  await provider.waitForDeploy(
    giverDefi.address
  );

  ui.write(`GiverDefi: ${giverDefi.address.toString()}`);

  const giverDao = provider.open(
    GiverDao.createFromConfig(
      {
        managerAddress: giverManager.address,
        bankDaoAddress: deployer,
        daoFoundationAddress: deployer,
      },
      compiled.giverDaoCode
    )
  );

  
}