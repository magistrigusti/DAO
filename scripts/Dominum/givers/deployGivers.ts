import { Address, OpenedContract, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';

import { DEPLOY_VALUES, DomDistributionAddresses } from '../core/config';
import { CompiledContracts } from '../core/types';

import { GiverAllodium } from '../../../wrappers/Dominum/givers/GiverAllodium';
import { GiverDefi } from '../../../wrappers/Dominum/givers/GiverDefi';
import { GiverDao } from '../../../wrappers/Dominum/givers/GiverDao';
import { GiverDominum } from '../../../wrappers/Dominum/givers/GiverDominum';

export type DeployedGivers = {
  giverAllodium: OpenedContract<GiverAllodium>;
  giverDefi: OpenedContract<GiverDefi>;
  giverDao: OpenedContract<GiverDao>;
  giverDominum: OpenedContract<GiverDominum>;
};

function assertAddress(
  label: string,
  actual: Address,
  expected: Address
): void {
  if (!actual.equals(expected)) {
    throw new Error(
      `${label}: expected ${expected.toString()}, ` +
      `received ${actual.toString()}`
    );
  }
}

function assertDistinctGiverAddresses(givers: DeployedGivers): void {
  const entries = Object.entries(givers);
  const uniqueAddresses = new Set(
    entries.map(([, giver]) => giver.address.toRawString())
  );

  if (uniqueAddresses.size !== entries.length) {
    throw new Error(
      'Giver StateInit collision: all Giver addresses must be distinct'
    );
  }
}

export async function deployGivers(
  provider: NetworkProvider,
  compiled: CompiledContracts,
  masterAddress: Address,
  treasuryPoolAddress: Address,
  distribution: DomDistributionAddresses
): Promise<DeployedGivers> {
  const ui = provider.ui();
  const sender = provider.sender();

  ui.write('--- Step 8: Deploy Givers with permanent recipient addresses ---');

  const giverAllodium = provider.open(
    GiverAllodium.createFromConfig(
      {
        masterAddress,
        treasuryPoolAddress,
        jettonWalletCode: compiled.walletCode,
        frsAllodiumAddress: distribution.frsAllodium,
        allodiumFoundationAddress: distribution.allodiumFoundation,
      },
      compiled.giverAllodiumCode
    )
  );

  const giverDefi = provider.open(
    GiverDefi.createFromConfig(
      {
        masterAddress,
        treasuryPoolAddress,
        jettonWalletCode: compiled.walletCode,
        marketAddress: distribution.defiMarket,
        foundryAddress: distribution.defiFoundry,
        defiTreasuryAddress: distribution.defiTreasury,
      },
      compiled.giverDefiCode
    )
  );

  const giverDao = provider.open(
    GiverDao.createFromConfig(
      {
        masterAddress,
        treasuryPoolAddress,
        jettonWalletCode: compiled.walletCode,
        bankDaoAddress: distribution.daoBank,
        daoFoundationAddress: distribution.daoFoundation,
      },
      compiled.giverDaoCode
    )
  );

  const giverDominum = provider.open(
    GiverDominum.createFromConfig(
      {
        masterAddress,
        treasuryPoolAddress,
        jettonWalletCode: compiled.walletCode,
        bankDominumAddress: distribution.dominumBank,
        dominumFoundationAddress: distribution.dominumFoundation,
      },
      compiled.giverDominumCode
    )
  );

  const givers = {
    giverAllodium,
    giverDefi,
    giverDao,
    giverDominum,
  };

  assertDistinctGiverAddresses(givers);

  await giverAllodium.sendDeploy(sender, toNano(DEPLOY_VALUES.giver));
  await provider.waitForDeploy(giverAllodium.address);
  await giverDefi.sendDeploy(sender, toNano(DEPLOY_VALUES.giver));
  await provider.waitForDeploy(giverDefi.address);
  await giverDao.sendDeploy(sender, toNano(DEPLOY_VALUES.giver));
  await provider.waitForDeploy(giverDao.address);
  await giverDominum.sendDeploy(sender, toNano(DEPLOY_VALUES.giver));
  await provider.waitForDeploy(giverDominum.address);

  const [allodiumData, defiData, daoData, dominumData] = await Promise.all([
    giverAllodium.getGiverData(),
    giverDefi.getGiverData(),
    giverDao.getGiverData(),
    giverDominum.getGiverData(),
  ]);

  assertAddress(
    'GiverAllodium master',
    allodiumData.masterAddress,
    masterAddress
  );
  assertAddress(
    'GiverAllodium treasury',
    allodiumData.treasuryPoolAddress,
    treasuryPoolAddress
  );
  assertAddress(
    'GiverAllodium FRS',
    allodiumData.frsAllodiumAddress,
    distribution.frsAllodium
  );
  assertAddress(
    'GiverAllodium Foundation',
    allodiumData.allodiumFoundationAddress,
    distribution.allodiumFoundation
  );
  assertAddress(
    'GiverDefi master',
    defiData.masterAddress,
    masterAddress
  );
  assertAddress(
    'GiverDefi treasury',
    defiData.treasuryPoolAddress,
    treasuryPoolAddress
  );
  assertAddress(
    'GiverDefi Market',
    defiData.marketAddress,
    distribution.defiMarket
  );
  assertAddress(
    'GiverDefi Foundry',
    defiData.foundryAddress,
    distribution.defiFoundry
  );
  assertAddress(
    'GiverDefi Treasury',
    defiData.defiTreasuryAddress,
    distribution.defiTreasury
  );
  assertAddress(
    'GiverDao master',
    daoData.masterAddress,
    masterAddress
  );
  assertAddress(
    'GiverDao treasury',
    daoData.treasuryPoolAddress,
    treasuryPoolAddress
  );
  assertAddress(
    'GiverDao Bank',
    daoData.bankDaoAddress,
    distribution.daoBank
  );
  assertAddress(
    'GiverDao Foundation',
    daoData.daoFoundationAddress,
    distribution.daoFoundation
  );
  assertAddress(
    'GiverDominum master',
    dominumData.masterAddress,
    masterAddress
  );
  assertAddress(
    'GiverDominum treasury',
    dominumData.treasuryPoolAddress,
    treasuryPoolAddress
  );
  assertAddress(
    'GiverDominum Bank',
    dominumData.bankDominumAddress,
    distribution.dominumBank
  );
  assertAddress(
    'GiverDominum Foundation',
    dominumData.dominumFoundationAddress,
    distribution.dominumFoundation
  );

  ui.write(`GiverAllodium: ${giverAllodium.address.toString()}`);
  ui.write(`GiverDefi: ${giverDefi.address.toString()}`);
  ui.write(`GiverDao: ${giverDao.address.toString()}`);
  ui.write(`GiverDominum: ${giverDominum.address.toString()}`);
  ui.write('All Giver recipient addresses verified.');

  return givers;
}
