import {
  toNano,
} from '@ton/core';
import {
  NetworkProvider,
} from '@ton/blueprint';

import {
  DEPLOY_VALUES,
  DomSignerAddresses,
  METADATA_URL,
} from '../core/config';
import {
  buildOffChainContent,
  buildTypedPlaceholderAddress,
} from '../core/helpers';
import {
  CompiledContracts,
  InfrastructureContracts,
  TokenGraphContracts,
} from '../core/types';

import { DomMaster } from '../../../wrappers/Dominum/dom/DomMaster';
import { Minter } from '../../../wrappers/Dominum/treasury/Minter';
import {
  MinterManager,
} from '../../../wrappers/Dominum/management/MinterManager';

import { deployGiverManager } from '../management/deployGiverManager';
import { deployGivers } from '../givers/deployGivers';

export async function deployTokenGraph(
  provider: NetworkProvider,
  compiled: CompiledContracts,
  infrastructure: InfrastructureContracts,
  signers: DomSignerAddresses
): Promise<TokenGraphContracts> {
  const ui = provider.ui();
  const sender = provider.sender();

  const giverManager = await deployGiverManager(
    provider,
    compiled,
    signers.giverManager
  );

  ui.write('--- Step 4: Deploy MinterManager ---');

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
  await provider.waitForDeploy(minterManager.address);

  ui.write(
    `MinterManager: ${minterManager.address.toString()}`
  );

  ui.write('--- Step 5: Deploy DomMaster with placeholders ---');

  const content = buildOffChainContent(
    METADATA_URL
  );

  const placeholderMinter = buildTypedPlaceholderAddress(20, 1);
  const placeholderGiverAllodium = buildTypedPlaceholderAddress(21, 1);
  const placeholderGiverDefi = buildTypedPlaceholderAddress(21, 2);
  const placeholderGiverDao = buildTypedPlaceholderAddress(21, 3);
  const placeholderGiverDominum = buildTypedPlaceholderAddress(21, 4);

  const domMaster = provider.open(
    DomMaster.createFromConfig(
      {
        totalSupply: 0n,
        ownerAddress: signers.master,
        lastMintTime: 0n,
        isStarted: false,

        gasRouterAddress: infrastructure.gasRouter.address,

        // Временный minter. После деплоя Minter заменим через MinterManager.
        minterAddress: placeholderMinter,
        minterManagerAddress: minterManager.address,
        giverManagerAddress: giverManager.address,

        // Временные разные адреса. Они нужны, чтобы replaceGiver
        // точно понимал, какой слот master нужно заменить.
        giverAllodiumAddress: placeholderGiverAllodium,
        giverDefiAddress: placeholderGiverDefi,
        giverDaoAddress: placeholderGiverDao,
        giverDominumAddress: placeholderGiverDominum,
        hasPendingMasterRequest: false,

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
  await provider.waitForDeploy(domMaster.address);

  ui.write(
    `DomMaster: ${domMaster.address.toString()}`
  );

  ui.write('--- Step 6: Deploy Minter ---');

  const minter = provider.open(
    Minter.createFromConfig(
      {
        ownerAddress: signers.minter,
        masterAddress: domMaster.address,
      },
      compiled.minterCode
    )
  );

  await minter.sendDeploy(
    sender,
    toNano(DEPLOY_VALUES.minter)
  );
  await provider.waitForDeploy(minter.address);

  ui.write(
    `Minter: ${minter.address.toString()}`
  );

  const givers = await deployGivers(
    provider,
    compiled,
    domMaster.address,
    infrastructure.gasRouter.address
  );

  ui.write(
    'Role contracts deployed. Separate signer transactions must create and confirm Master requests.'
  );

  return {
    giverManager,
    minterManager,
    minter,
    domMaster,
    giverAllodium: givers.giverAllodium,
    giverDefi: givers.giverDefi,
    giverDao: givers.giverDao,
    giverDominum: givers.giverDominum,
  };
}
