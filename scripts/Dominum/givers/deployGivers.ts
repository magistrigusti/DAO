import {
  Address,
  OpenedContract,
  toNano,
} from '@ton/core';
import {
  NetworkProvider,
} from '@ton/blueprint';

import { DEPLOY_VALUES } from '../core/config';
import { CompiledContracts } from '../core/types';

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

export type DeployedGivers = {
  giverAllodium: OpenedContract<GiverAllodium>;
  giverDefi: OpenedContract<GiverDefi>;
  giverDao: OpenedContract<GiverDao>;
  giverDominum: OpenedContract<GiverDominum>;
};

export async function deployGivers(
  provider: NetworkProvider,
  compiled: CompiledContracts,
  masterAddress: Address,
  gasPoolAddress: Address,
  deployer: Address
): Promise<DeployedGivers> {
  const ui = provider.ui();
  const sender = provider.sender();

  ui.write('--- Step 8: Deploy Givers ---');

  const giverAllodium = provider.open(
    GiverAllodium.createFromConfig(
      {
        masterAddress,
        gasPoolAddress,
        jettonWalletCode: compiled.walletCode,
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
  await provider.waitForDeploy(giverAllodium.address);

  ui.write(
    `GiverAllodium: ${giverAllodium.address.toString()}`
  );

  const giverDefi = provider.open(
    GiverDefi.createFromConfig(
      {
        masterAddress,
        gasPoolAddress,
        jettonWalletCode: compiled.walletCode,
        marketAddress: deployer,
        foundryAddress: deployer,
        defiTreasuryAddress: deployer,
      },
      compiled.giverDefiCode
    )
  );

  await giverDefi.sendDeploy(
    sender,
    toNano(DEPLOY_VALUES.giver)
  );
  await provider.waitForDeploy(giverDefi.address);

  ui.write(
    `GiverDefi: ${giverDefi.address.toString()}`
  );

  const giverDao = provider.open(
    GiverDao.createFromConfig(
      {
        masterAddress,
        gasPoolAddress,
        jettonWalletCode: compiled.walletCode,
        bankDaoAddress: deployer,
        daoFoundationAddress: deployer,
      },
      compiled.giverDaoCode
    )
  );

  await giverDao.sendDeploy(
    sender,
    toNano(DEPLOY_VALUES.giver)
  );
  await provider.waitForDeploy(giverDao.address);

  ui.write(
    `GiverDao: ${giverDao.address.toString()}`
  );

  const giverDominum = provider.open(
    GiverDominum.createFromConfig(
      {
        masterAddress,
        gasPoolAddress,
        jettonWalletCode: compiled.walletCode,
        bankDominumAddress: deployer,
        dominumFoundationAddress: deployer,
      },
      compiled.giverDominumCode
    )
  );

  await giverDominum.sendDeploy(
    sender,
    toNano(DEPLOY_VALUES.giver)
  );
  await provider.waitForDeploy(giverDominum.address);

  ui.write(
    `GiverDominum: ${giverDominum.address.toString()}`
  );

  return {
    giverAllodium,
    giverDefi,
    giverDao,
    giverDominum,
  };
}