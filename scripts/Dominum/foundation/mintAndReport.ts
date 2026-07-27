import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';

import {
  DEPLOY_VALUES,
  DomDistributionAddresses,
  DomRecipientControls,
  FIRST_MINT_CONFIG,
} from '../core/config';

import {
  CompiledContracts,
  InfrastructureContracts,
  TokenGraphContracts,
} from '../core/types';

import { buildExpectedDistribution } from './mintDistribution';
import { assertFirstMintReady } from './mintPreflight';
import { verifyFirstMintDistribution } from './mintVerification';

function reportAddress(
  provider: NetworkProvider, label: string, address: Address
): void {
  provider.ui().write(`${label}: ${address.toString()}`);
}

function reportContractAddresses(
  provider: NetworkProvider, infrastructure: InfrastructureContracts,
  graph: TokenGraphContracts
): void {
  provider.ui().write('CONTRACT ADDRESSES');

  reportAddress(provider, 'DomMaster', graph.domMaster.address);
  reportAddress(provider, 'Minter', graph.minter.address);
  reportAddress(provider, 'MinterManager', graph.minterManager.address);

  reportAddress(
    provider, 'TreasuryManager', infrastructure.treasuryManager.address
  );

  reportAddress(
    provider, 'TreasuryPool', infrastructure.treasuryPool.address
  );

  reportAddress(provider, 'GasPool', infrastructure.gasPool.address);
  reportAddress(provider, 'GiverManager', graph.giverManager.address);
  reportAddress(provider, 'GiverAllodium', graph.giverAllodium.address);
  reportAddress(provider, 'GiverDefi', graph.giverDefi.address);
  reportAddress(provider, 'GiverDao', graph.giverDao.address);
  reportAddress(provider, 'GiverDominum', graph.giverDominum.address);
}

export async function mintAndReport(
  provider: NetworkProvider, infrastructure: InfrastructureContracts,
  graph: TokenGraphContracts, distribution: DomDistributionAddresses,
  controls: DomRecipientControls, compiled: CompiledContracts
): Promise<void> {
  const config = FIRST_MINT_CONFIG;

  await assertFirstMintReady(
    provider,
    infrastructure,
    graph,
    distribution,
    controls,
    compiled
  );

  const expectedDistribution = buildExpectedDistribution(distribution);

  provider.ui().write('--- First mint through Minter ---');

  provider.ui().write(
    `Minting ${config.amount.toString()} DOM units`
  );

  await graph.minter.sendMint(
    provider.sender(),
    {
      value: toNano(DEPLOY_VALUES.mint),
      amount: config.amount, queryId: config.queryId,
    }
  );

  await provider.waitForLastTransaction();

  await verifyFirstMintDistribution(
    provider, infrastructure, graph, expectedDistribution
  );

  const [jetton, master, gas, treasury] = await Promise.all([
    graph.domMaster.getJettonData(),
    graph.domMaster.getMasterData(),
    infrastructure.gasPool.getGasPoolData(),
    infrastructure.treasuryPool.getTreasuryPoolData(),
  ]);

  if (!master.isStarted) {
    throw new Error('DomMaster did not enter started state');
  }

  provider.ui().write('FIRST MINT CONFIRMED');
  provider.ui().write(`Total supply: ${jetton.totalSupply.toString()}`);
  provider.ui().write(`Gas executions: ${gas.totalExecuted.toString()}`);
  provider.ui().write(`DOM fees: ${gas.totalReceivedDom.toString()}`);
  provider.ui().write(`Next route: ${treasury.nextRouteId.toString()}`);

  reportContractAddresses(provider, infrastructure, graph);
}
