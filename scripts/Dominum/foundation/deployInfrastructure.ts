import {
  Address,
  toNano,
} from '@ton/core';
import {
  NetworkProvider,
} from '@ton/blueprint';

import { DEPLOY_VALUES } from '../core/config';
import {
  CompiledContracts,
  InfrastructureContracts,
} from '../core/types';

import {
  TreasuryManager,
} from '../../../wrappers/Dominum/management/TreasuryManager';
import {
  TreasuryPool,
} from '../../../wrappers/Dominum/treasury/TreasuryPool';
import {
  GasPool,
} from '../../../wrappers/Dominum/pools/GasPool';

export async function deployInfrastructure(
  provider: NetworkProvider,
  compiled: CompiledContracts,
  deployer: Address
): Promise<InfrastructureContracts> {
  const ui = provider.ui();
  const sender = provider.sender();

  ui.write('--- Step 1: Deploy TreasuryManager ---');

  const treasuryManager = provider.open(
    TreasuryManager.createFromConfig(
      {
        ownerAddress: deployer,
      },
      compiled.treasuryManagerCode
    )
  );

  await treasuryManager.sendDeploy(
    sender,
    toNano(DEPLOY_VALUES.treasuryManager)
  );
  await provider.waitForDeploy(treasuryManager.address);

  ui.write(
    `TreasuryManager: ${treasuryManager.address.toString()}`
  );

  ui.write('--- Step 2: Deploy TreasuryPool ---');

  const treasuryPool = provider.open(
    TreasuryPool.createFromConfig(
      {
        ownerAddress: deployer,
        treasuryManagerAddress: treasuryManager.address,

        // Временный адрес. Реальный wallet казначейства пишем позже
        // через OP_INIT_TREASURY_WALLET_CONFIG.
        jettonWalletAddress: deployer,
        walletConfigured: false,

        // Временные цели. Реальный GasPool ставим позже
        // через TreasuryManager -> TreasuryPool request/confirm.
        bankDaoAddress: deployer,
        bankDefiAddress: deployer,
        bankDominumAddress: deployer,
        gasPoolAddress: deployer,
      },
      compiled.treasuryPoolCode
    )
  );

  await treasuryPool.sendDeploy(
    sender,
    toNano(DEPLOY_VALUES.treasuryPool)
  );
  await provider.waitForDeploy(treasuryPool.address);

  ui.write(
    `TreasuryPool: ${treasuryPool.address.toString()}`
  );

  ui.write('--- Step 3: Deploy GasPool ---');

  const gasPool = provider.open(
    GasPool.createFromConfig(
      {
        treasuryPoolAddress: treasuryPool.address,

        // Временная связка. Реальный Master пишем позже
        // через TreasuryPool -> GasPool OP_INIT_MASTER_CONFIG.
        masterAddress: deployer,
        jettonWalletCode: compiled.walletCode,
        masterConfigured: false,
      },
      compiled.gasPoolCode
    )
  );

  await gasPool.sendDeploy(
    sender,
    toNano(DEPLOY_VALUES.gasPool)
  );
  await provider.waitForDeploy(gasPool.address);

  ui.write(
    `GasPool: ${gasPool.address.toString()}`
  );

  return {
    deployer,
    treasuryManager,
    treasuryPool,
    gasPool,
  };
}