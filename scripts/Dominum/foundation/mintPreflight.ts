import { NetworkProvider } from '@ton/blueprint';

import {
  DomDistributionAddresses, FIRST_MINT_CONFIG,
} from '../core/config';

import {
  InfrastructureContracts, TokenGraphContracts,
} from '../core/types';

import { assertAddress, assertGiverRouting } from './mintRouting';

export async function assertFirstMintReady(
  provider: NetworkProvider, infrastructure: InfrastructureContracts,
  graph: TokenGraphContracts, distribution: DomDistributionAddresses
): Promise<void> {
  const senderAddress = provider.sender().address;

  if (!senderAddress) {
    throw new Error('Sender address is not available');
  }

  const [
    jetton, master, masterPending, minter, givers,
    gas, treasury, treasuryPending, canMint,
  ] = await Promise.all([
    graph.domMaster.getJettonData(),
    graph.domMaster.getMasterData(),
    graph.domMaster.getMasterPendingRequest(),
    graph.minter.getMinterData(),
    graph.domMaster.getGiversData(),
    infrastructure.gasPool.getGasPoolData(),
    infrastructure.treasuryPool.getTreasuryPoolData(),
    infrastructure.treasuryPool.getTreasuryPendingData(),
    graph.domMaster.canMintNow(),
  ]);

  const config = FIRST_MINT_CONFIG;

  if (jetton.totalSupply !== config.emptyAmount) {
    throw new Error('First mint requires zero total supply');
  }

  if (master.isStarted) {
    throw new Error('DomMaster has already started');
  }

  if (masterPending.hasPending) {
    throw new Error('DomMaster has a pending role request');
  }

  if (treasuryPending.hasPending) {
    throw new Error('TreasuryPool has a pending configuration request');
  }

  assertAddress(
    master.treasuryPoolAddress, infrastructure.treasuryPool.address,
    'Master TreasuryPool'
  );

  assertAddress(master.minterAddress, graph.minter.address, 'Active Minter');

  assertAddress(
    master.minterManagerAddress, graph.minterManager.address,
    'Active MinterManager'
  );

  assertAddress(
    master.giverManagerAddress, graph.giverManager.address,
    'Active GiverManager'
  );

  assertAddress(minter.masterAddress, graph.domMaster.address, 'Minter master');
  assertAddress(minter.ownerAddress, senderAddress, 'Mint signer');

  assertAddress(
    givers.giverAllodiumAddress, graph.giverAllodium.address,
    'Active GiverAllodium'
  );

  assertAddress(
    givers.giverDefiAddress, graph.giverDefi.address, 'Active GiverDefi'
  );

  assertAddress(
    givers.giverDaoAddress, graph.giverDao.address, 'Active GiverDao'
  );

  assertAddress(
    givers.giverDominumAddress, graph.giverDominum.address,
    'Active GiverDominum'
  );

  if (!gas.masterConfigured) {
    throw new Error('GasPool master is not configured');
  }

  assertAddress(gas.masterAddress, graph.domMaster.address, 'GasPool master');

  assertAddress(
    gas.treasuryPoolAddress, infrastructure.treasuryPool.address,
    'GasPool TreasuryPool'
  );

  if (gas.tonBalance < config.minimumGasPoolTonBalance) {
    throw new Error('GasPool TON balance is too small');
  }

  if (gas.totalReceivedDom !== config.emptyAmount) {
    throw new Error('GasPool already received DOM');
  }

  if (gas.totalSpentTon !== config.emptyAmount) {
    throw new Error('GasPool already spent TON');
  }

  if (gas.totalExecuted !== config.emptyAmount) {
    throw new Error('GasPool already executed transfer routes');
  }

  if (!treasury.walletConfigured) {
    throw new Error('TreasuryPool wallet is not configured');
  }

  assertAddress(
    treasury.gasPoolAddress, infrastructure.gasPool.address,
    'TreasuryPool GasPool'
  );

  const treasuryWallet = await graph.domMaster.getWalletAddress(
    infrastructure.treasuryPool.address
  );

  assertAddress(
    treasury.jettonWalletAddress, treasuryWallet, 'TreasuryPool DOM wallet'
  );

  if (treasury.nextRouteId !== config.initialRouteId) {
    throw new Error('TreasuryPool routing state is not empty');
  }

  if (!canMint) {
    throw new Error('DomMaster reports that mint is unavailable');
  }

  await assertGiverRouting(graph, infrastructure, distribution);
}