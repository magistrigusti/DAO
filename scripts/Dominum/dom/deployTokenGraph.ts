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

import { deployGiverManager } from '../management/deployGiverManager';
import { deployGivers } from '../givers/deployGivers';

export async function deployTokenGraph(
  provider: NetworkProvider,
  compiled: CompiledContracts,
  infrastructure: InfrastructureContracts,
  deployer: Address
): Promise<TokenGraphContracts> {
  const ui = provider.ui();
  const sender = provider.sender();

  const giverManager = await deployGiverManager(
      provider,
      compiled,
      deployer
  );

  const givers = await deployGivers(
      provider,
      compiled,
      giverManager,
      deployer
  );

  ui.write('--- Step 5: Deploy DomMaster ---');

  const content = buildOffChainContent(
      METADATA_URL
  );

  const domMaster = provider.open(
      DomMaster.createFromConfig(
          {
              totalSupply: 0n,
              ownerAddress: deployer,
              lastMintTime: 0n,
              isStarted: false,
              gasPoolAddress: infrastructure.gasProxy.address,
              giverAllodiumAddress: givers.giverAllodium.address,
              giverDefiAddress: givers.giverDefi.address,
              giverDaoAddress: givers.giverDao.address,
              giverDominumAddress: givers.giverDominum.address,
              content,
              jettonWalletCode: compiled.walletCode,
          },
          compiled.masterCode
      )
  );

  await domMaster.sendDeploy(
      sender,
      toNano(DEPLOY_VALUES.master)
  );

  await provider.waitForDeploy(
      domMaster.address
  );

  ui.write(
      `DomMaster: ${domMaster.address.toString()}`
  );

  return {
      giverManager,
      giverAllodium: givers.giverAllodium,
      giverDefi: givers.giverDefi,
      giverDao: givers.giverDao,
      giverDominum: givers.giverDominum,
      domMaster,
  };
}