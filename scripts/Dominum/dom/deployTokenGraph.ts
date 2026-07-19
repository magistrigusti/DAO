import { toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';

import {
  DEPLOY_VALUES,
  DomDistributionAddresses,
  DomSignerAddresses,
  METADATA_URL,
} from '../core/config';
import { buildOffChainContent, buildTypedPlaceholderAddress } from '../core/helpers';
import { CompiledContracts, InfrastructureContracts, TokenGraphContracts } from '../core/types';

import { DomMaster } from '../../../wrappers/Dominum/dom/DomMaster';
import { Minter } from '../../../wrappers/Dominum/treasury/Minter';
import { MinterManager } from '../../../wrappers/Dominum/management/MinterManager';

import { deployGiverManager } from '../management/deployGiverManager';
import { deployGivers } from '../givers/deployGivers';

export async function deployTokenGraph(
  provider: NetworkProvider,
  compiled: CompiledContracts,
  infrastructure: InfrastructureContracts,
  signers: DomSignerAddresses,
  distribution: DomDistributionAddresses
): Promise<TokenGraphContract> {
  const ui = provider.ui();
  const sender = provider.sender();

  const giverManager = await deployGiverManager(
    provider,
    compiled,
    signers.giverManager
  );

  ui.write('Step 5: Deploy MinterManager');

  const minterManager = provider.open(
    MinterManager.createFromConfig(
      {
        ownerAddress: signers.minterManager,
      },
      compiled.minterManagerCode
    )
  );

  await minterManager.sendDeploy(
    sender,
    toNano(DEPLOY_VALUES.minterManager)
  );

  await provider.waitForDeploy(
    minterManager.address
  );

  ui.write(
    `MinterManager: ${minterManager.address.toString()}`
  );

  const minterPlaceholder = buildTypedPlaceholderAddress(
    20, 1
  );

  const allodiumPlaceholder = buildTypedPlaceholderAddress(
    21,
    GIVER_TARGET.allodium
  );

  const defiPlaceholder = buildTypedPlaceholderAddress(
    21,
    GIVER_TARGET.defi
  );

  const daoPlaceholder = buildTypedPlaceholderAddress(
    21,
    GIVER_TARGET.dao
  );

  const dominumPlaceholder = buildTypedPlaceholderAddress(
    21,
    GIVER_TARGET.dominum
  );

  ui.write('Step 6: Deploy DomMaster');

  const domMaster = provider.open(
    DomMaster.createFromConfig(
      {
        totalSupply: 0n,
        ownerAddress: signers.master,
        lastMintTime: 0n,
        isStarted: false,

        treasuryPoolAddress: infrastructure.treasuryPool.address,

        minerAddress: minterPlaceholder,
        minterManagerAddress: minterManager.address,
        giverManagerAddress: giverManager.address,
      }
    )
  )
}