import { Address } from '@ton/core';

import { DomDistributionAddresses } from '../core/config';

import {
  InfrastructureContracts, TokenGraphContracts,
} from '../core/types';

type GiverCoreData = {
  masterAddress: Address; treasuryPoolAddress: Address; walletAddress: Address;
};

export function assertAddress(
  actual: Address, expected: Address, label: string
): void {
  if (!actual.equals(expected)) {
    throw new Error(`${label} address mismatch`);
  }
}

function assertGiverCore(
  data: GiverCoreData, expectedWallet: Address, label: string,
  infrastructure: InfrastructureContracts, graph: TokenGraphContracts
): void {
  assertAddress(data.masterAddress, graph.domMaster.address, `${label} master`);

  assertAddress(
    data.treasuryPoolAddress, infrastructure.treasuryPool.address,
    `${label} TreasuryPool`
  );

  assertAddress(data.walletAddress, expectedWallet, `${label} wallet`);
}

export async function assertGiverRouting(
  graph: TokenGraphContracts, infrastructure: InfrastructureContracts,
  distribution: DomDistributionAddresses
): Promise<void> {
  const [allodium, defi, dao, dominum] = await Promise.all([
    graph.giverAllodium.getGiverData(), graph.giverDefi.getGiverData(),
    graph.giverDao.getGiverData(), graph.giverDominum.getGiverData(),
  ]);

  const [allodiumWallet, defiWallet, daoWallet, dominumWallet] =
    await Promise.all([
      graph.domMaster.getWalletAddress(graph.giverAllodium.address),
      graph.domMaster.getWalletAddress(graph.giverDefi.address),
      graph.domMaster.getWalletAddress(graph.giverDao.address),
      graph.domMaster.getWalletAddress(graph.giverDominum.address),
    ]);

  assertGiverCore(
    allodium, allodiumWallet, 'GiverAllodium', infrastructure, graph
  );

  assertGiverCore(defi, defiWallet, 'GiverDefi', infrastructure, graph);
  assertGiverCore(dao, daoWallet, 'GiverDao', infrastructure, graph);

  assertGiverCore(
    dominum, dominumWallet, 'GiverDominum', infrastructure, graph
  );

  assertAddress(
    allodium.frsAllodiumAddress, distribution.frsAllodium, 'Allodium FRS'
  );

  assertAddress(
    allodium.allodiumFoundationAddress,
    distribution.allodiumFoundation, 'Allodium Foundation'
  );

  assertAddress(defi.marketAddress, distribution.defiMarket, 'DeFi Market');
  assertAddress(defi.foundryAddress, distribution.defiFoundry, 'DeFi Foundry');

  assertAddress(
    defi.defiTreasuryAddress, distribution.defiTreasury, 'DeFi Treasury'
  );

  assertAddress(dao.bankDaoAddress, distribution.daoBank, 'DAO Bank');

  assertAddress(
    dao.daoFoundationAddress, distribution.daoFoundation, 'DAO Foundation'
  );

  assertAddress(
    dominum.bankDominumAddress, distribution.dominumBank, 'Dominum Bank'
  );

  assertAddress(
    dominum.dominumFoundationAddress,
    distribution.dominumFoundation, 'Dominum Foundation'
  );
}