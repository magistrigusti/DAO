import { Cell } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { FrsAllodium } from '../../../wrappers/Allodium/treasury/FrsAllodium';
import {
  ALLODIUM_DEFAULTS,
  ALLODIUM_PREFLIGHT,
  AllodiumBootstrapConfig,
  AllodiumDeploymentAddresses,
} from '../core/config';
import {
  AllodiumBootstrapContracts,
  CompiledAllodiumContracts,
} from '../core/types';
import { assertAllodiumMetadata } from './metadataPreflight';

async function assertCode(
  provider: NetworkProvider,
  address: AllodiumBootstrapContracts['allodMaster']['address'],
  expected: Cell,
  label: string
): Promise<void> {
  const state = await provider.getContractState(address);

  if (state.state.type !== 'active' || !state.state.code) {
    throw new Error(`${label} is not active`);
  }

  const roots = Cell.fromBoc(state.state.code);

  if (roots.length !== 1 || !roots[0].hash().equals(expected.hash())) {
    throw new Error(`${label} code hash mismatch`);
  }
}

function requireEmpty(value: bigint, label: string): void {
  if (value !== ALLODIUM_PREFLIGHT.emptyAmount) {
    throw new Error(`${label} must be empty before first DOM mint`);
  }
}

export async function assertAllodiumReady(
  provider: NetworkProvider,
  contracts: AllodiumBootstrapContracts,
  compiled: CompiledAllodiumContracts,
  config: AllodiumBootstrapConfig,
  addresses: AllodiumDeploymentAddresses
): Promise<void> {
  const frs = provider.open(
    FrsAllodium.createFromAddress(addresses.frsAllodium)
  );
  const [master, jetton, gas, frsData] = await Promise.all([
    contracts.allodMaster.getMasterData(),
    contracts.allodMaster.getJettonData(),
    contracts.allodGasPool.getAllodGasPoolData(),
    frs.getFrsData(),
  ]);

  await Promise.all([
    assertCode(
      provider,
      contracts.allodMaster.address,
      compiled.allodMasterCode,
      'AllodMaster'
    ),
    assertCode(
      provider,
      contracts.allodGasPool.address,
      compiled.allodGasPoolCode,
      'AllodGasPool'
    ),
    assertCode(
      provider,
      frs.address,
      compiled.frsAllodiumCode,
      'FrsAllodium'
    ),
  ]);

  if (!master.ownerAddress.equals(config.masterOwner)) {
    throw new Error('AllodMaster owner mismatch');
  }
  if (!master.frsConfigured ||
    !master.frsAddress.equals(frs.address)) {
    throw new Error('AllodMaster FRS is not configured');
  }
  if (!master.gasPoolAddress.equals(contracts.allodGasPool.address)) {
    throw new Error('AllodMaster GasPool mismatch');
  }
  if (!gas.authorityAddress.equals(config.gasPoolAuthority)) {
    throw new Error('AllodGasPool authority mismatch');
  }
  if (!gas.masterConfigured ||
    !gas.masterAddress.equals(contracts.allodMaster.address)) {
    throw new Error('AllodGasPool master is not configured');
  }
  if (!frsData.allodMasterAddress.equals(contracts.allodMaster.address)) {
    throw new Error('FRS AllodMaster mismatch');
  }
  if (!frsData.giverConfigured || !frsData.walletConfigured) {
    throw new Error('FRS DOM routing is not configured');
  }
  if (!jetton.jettonWalletCode.hash().equals(
    compiled.allodWalletCode.hash()
  )) {
    throw new Error('AllodMaster wallet code mismatch');
  }
  await assertAllodiumMetadata(jetton.content, config.metadataUrl);
  if (gas.transferFeeAllod !== ALLODIUM_DEFAULTS.transferFeeAllod) {
    throw new Error('AllodGasPool transfer fee mismatch');
  }
  if (gas.tonBalance < ALLODIUM_PREFLIGHT.minimumGasPoolBalance) {
    throw new Error('AllodGasPool TON balance is too small');
  }

  requireEmpty(master.totalSupply, 'ALLOD total supply');
  requireEmpty(master.mintAllowancePool, 'ALLOD mint allowance');
  requireEmpty(gas.totalReceivedAllod, 'AllodGasPool received amount');
  requireEmpty(gas.totalSpentTon, 'AllodGasPool spent amount');
  requireEmpty(gas.totalExecuted, 'AllodGasPool execution counter');
  requireEmpty(frsData.lockedDom, 'FRS locked DOM');
}
