import { Address } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';

import {
  DomDistributionAddresses,
  DomRecipientControls,
  FIRST_MINT_CONFIG,
} from '../core/config';

import {
  CompiledContracts,
  InfrastructureContracts,
  TokenGraphContracts,
} from '../core/types';

import { assertAddress, assertGiverRouting } from './mintRouting';
import {
  assertRecipientContractsReady,
} from './recipientPreflight';
import { assertDomMetadata } from './metadataPreflight';

function assertIndependentRoleAddresses(roles: Address[]): void {
  const unique = new Set(
    roles.map((address) => address.toRawString())
  );

  if (unique.size !== roles.length) {
    throw new Error('DOM control or contract roles intersect');
  }
}

export async function assertFirstMintReady(
  provider: NetworkProvider, infrastructure: InfrastructureContracts,
  graph: TokenGraphContracts, distribution: DomDistributionAddresses,
  controls: DomRecipientControls, compiled: CompiledContracts
): Promise<void> {
  const senderAddress = provider.sender().address;

  if (!senderAddress) {
    throw new Error('Sender address is not available');
  }

  const [
    jetton, master, masterPending, minter, givers,
    gas, treasury, treasuryPending, canMint, gasTransferFee,
    treasuryManagerOwner, minterManagerOwner, giverManagerOwner,
  ] = await Promise.all([
    graph.domMaster.getJettonData(),
    graph.domMaster.getMasterData(),
    graph.domMaster.getMasterPendingRequest(),
    graph.minter.getMinterData(),
    graph.domMaster.getGiversData(),
    infrastructure.gasPool.getGasPoolData(),
    infrastructure.treasuryPool.getTreasuryPoolData(),
    infrastructure.treasuryPool.getTreasuryPendingData(),
    graph.domMaster.getCanMintNow(),
    infrastructure.gasPool.getDomTransferFee(),
    infrastructure.treasuryManager.getTreasuryManagerData(),
    graph.minterManager.getMinterManagerData(),
    graph.giverManager.getManagerData(),
  ]);

  const config = FIRST_MINT_CONFIG;

  if (!jetton.jettonWalletCode.hash().equals(compiled.walletCode.hash())) {
    throw new Error('DomMaster wallet code hash mismatch');
  }

  await assertDomMetadata(jetton.content);

  assertIndependentRoleAddresses([
    master.ownerAddress, treasury.ownerAddress, minter.ownerAddress,
    treasuryManagerOwner, minterManagerOwner, giverManagerOwner,
    controls.frsOwner, controls.allodiumFoundationOwner,
    controls.marketOwner, controls.foundryOwner,
    controls.defiBankOwner, controls.daoBankOwner,
    controls.daoFoundationOwner, controls.dominumBankOwner,
    controls.dominumFoundationOwner, infrastructure.deployer,
    infrastructure.treasuryManager.address,
    infrastructure.treasuryPool.address, infrastructure.gasPool.address,
    graph.giverManager.address, graph.minterManager.address,
    graph.minter.address, graph.domMaster.address,
    graph.giverAllodium.address, graph.giverDefi.address,
    graph.giverDao.address, graph.giverDominum.address,
    distribution.frsAllodium, distribution.allodiumFoundation,
    distribution.defiMarket, distribution.defiFoundry,
    distribution.defiTreasury, distribution.daoBank,
    distribution.daoFoundation, distribution.dominumBank,
    distribution.dominumFoundation, controls.allodMaster,
    controls.defiFoundation, controls.foundryRelease,
  ]);

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

  assertAddress(
    treasury.treasuryManagerAddress,
    infrastructure.treasuryManager.address,
    'TreasuryPool TreasuryManager'
  );

  if (treasury.taxMultiplier !== gas.taxMultiplier) {
    throw new Error('TreasuryPool and GasPool tax mismatch');
  }

  if (gasTransferFee !== config.giverFeeDom) {
    throw new Error('GasPool transfer fee is incompatible with Givers');
  }

  const [treasuryWallet, poolWallet, poolWalletFromGas] =
    await Promise.all([
      graph.domMaster.getWalletAddress(
        infrastructure.treasuryPool.address
      ),
      graph.domMaster.getWalletAddress(infrastructure.gasPool.address),
      infrastructure.gasPool.getPoolWalletAddress(),
    ]);

  assertAddress(
    treasury.jettonWalletAddress, treasuryWallet, 'TreasuryPool DOM wallet'
  );

  assertAddress(poolWalletFromGas, poolWallet, 'GasPool DOM wallet');

  if (treasury.nextRouteId !== config.initialRouteId) {
    throw new Error('TreasuryPool routing state is not empty');
  }

  if (!canMint) {
    throw new Error('DomMaster reports that mint is unavailable');
  }

  await assertGiverRouting(graph, infrastructure, distribution);

  await assertRecipientContractsReady(
    provider,
    infrastructure,
    graph,
    distribution,
    controls,
    compiled
  );
}
