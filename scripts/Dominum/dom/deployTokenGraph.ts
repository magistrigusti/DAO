import {
  Address,
  toNano,
} from '@ton/core';
import {
  NetworkProvider,
} from '@ton/blueprint';

import {
  DEPLOY_VALUES,
  FORWARDED_MESSAGE_WAIT_MS,
  METADATA_URL,
} from '../core/config';
import { buildOffChainContent, sleep } from '../core/helpers';
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
  deployer: Address
): Promise<TokenGraphContracts> {
  const ui = provider.ui();
  const sender = provider.sender();

  const giverManager = await deployGiverManager(
    provider,
    compiled,
    deployer
  );

  ui.write('--- Step 4: Deploy MinterManager ---');

  const minterManager = provider.open(
    MinterManager.createFromConfig(
      {
        ownerAddress: deployer,
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

  const placeholderGiverAllodium = deployer;
  const placeholderGiverDefi = giverManager.address;
  const placeholderGiverDao = minterManager.address;
  const placeholderGiverDominum = infrastructure.gasPool.address;

  const domMaster = provider.open(
    DomMaster.createFromConfig(
      {
        totalSupply: 0n,
        ownerAddress: deployer,
        lastMintTime: 0n,
        isStarted: false,

        gasPoolAddress: infrastructure.gasPool.address,

        // Временный minter. После деплоя Minter заменим через MinterManager.
        minterAddress: deployer,
        minterManagerAddress: minterManager.address,
        giverManagerAddress: giverManager.address,

        // Временные разные адреса. Они нужны, чтобы replaceGiver
        // точно понимал, какой слот master нужно заменить.
        giverAllodiumAddress: placeholderGiverAllodium,
        giverDefiAddress: placeholderGiverDefi,
        giverDaoAddress: placeholderGiverDao,
        giverDominumAddress: placeholderGiverDominum,

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
        ownerAddress: deployer,
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

  ui.write('--- Step 7: Connect Minter to DomMaster ---');

  await minterManager.sendReplaceMinter(
    sender,
    {
      value: toNano(DEPLOY_VALUES.roleConfig),
      masterAddress: domMaster.address,
      oldMinterAddress: deployer,
      newMinterAddress: minter.address,
      queryId: 31n,
    }
  );

  await provider.waitForLastTransaction();
  await sleep(FORWARDED_MESSAGE_WAIT_MS);

  const givers = await deployGivers(
    provider,
    compiled,
    domMaster.address,
    infrastructure.gasPool.address,
    deployer
  );

  ui.write('--- Step 9: Connect Givers to DomMaster ---');

  await giverManager.sendReplaceGiver(
    sender,
    {
      value: toNano(DEPLOY_VALUES.roleConfig),
      masterAddress: domMaster.address,
      oldGiverAddress: placeholderGiverAllodium,
      newGiverAddress: givers.giverAllodium.address,
      queryId: 41n,
    }
  );
  await provider.waitForLastTransaction();

  await giverManager.sendReplaceGiver(
    sender,
    {
      value: toNano(DEPLOY_VALUES.roleConfig),
      masterAddress: domMaster.address,
      oldGiverAddress: placeholderGiverDefi,
      newGiverAddress: givers.giverDefi.address,
      queryId: 42n,
    }
  );
  await provider.waitForLastTransaction();

  await giverManager.sendReplaceGiver(
    sender,
    {
      value: toNano(DEPLOY_VALUES.roleConfig),
      masterAddress: domMaster.address,
      oldGiverAddress: placeholderGiverDao,
      newGiverAddress: givers.giverDao.address,
      queryId: 43n,
    }
  );
  await provider.waitForLastTransaction();

  await giverManager.sendReplaceGiver(
    sender,
    {
      value: toNano(DEPLOY_VALUES.roleConfig),
      masterAddress: domMaster.address,
      oldGiverAddress: placeholderGiverDominum,
      newGiverAddress: givers.giverDominum.address,
      queryId: 44n,
    }
  );
  await provider.waitForLastTransaction();
  await sleep(FORWARDED_MESSAGE_WAIT_MS);

  ui.write('DomMaster roles configured.');

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