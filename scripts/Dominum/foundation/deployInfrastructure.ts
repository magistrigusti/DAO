import {
  Address,
  toNano,
} from '@ton/core';
import {
  NetworkProvider,
} from '@ton/blueprint';

import {
  DEPLOY_VALUES,
  DomSignerAddresses,
} from '../core/config';
import { buildTypedPlaceholderAddress } from '../core/helpers';
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
  deployer: Address,
  signers: DomSignerAddresses
): Promise<InfrastructureContracts> {
  const ui = provider.ui();
  const sender = provider.sender();

  ui.write('--- Step 1: Deploy TreasuryManager ---');

  const treasuryManager = provider.open(
    TreasuryManager.createFromConfig(
      {
        ownerAddress: signers.treasuryManager,
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

  ui.write('--- Step 2: Deploy permanent TreasuryPool ---');

  const treasuryPool = provider.open(
    TreasuryPool.createFromConfig(
      {
        ownerAddress: signers.treasuryPool,
        treasuryManagerAddress: treasuryManager.address,

        // Временный адрес. Реальный wallet казначейства пишем позже
        // через OP_INIT_TREASURY_WALLET_CONFIG.
        jettonWalletAddress: buildTypedPlaceholderAddress(1, 5),
        walletConfigured: false,

        // Временные цели. Реальный GasPool ставим позже
        // через TreasuryManager -> TreasuryPool request/confirm.
        bankDaoAddress: buildTypedPlaceholderAddress(1, 1),
        bankDefiAddress: buildTypedPlaceholderAddress(1, 2),
        bankDominumAddress: buildTypedPlaceholderAddress(1, 3),
        gasPoolAddress: buildTypedPlaceholderAddress(1, 4),
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
        masterAddress: buildTypedPlaceholderAddress(2, 1),
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

  const treasuryData = await treasuryPool.getTreasuryPoolData();
  const gasPoolData = await gasPool.getGasPoolData();

  if (
    !treasuryData.gasPoolAddress.equals(
      buildTypedPlaceholderAddress(1, 4)
    ) ||
    !gasPoolData.treasuryPoolAddress.equals(treasuryPool.address)
  ) {
    throw new Error(
      'Treasury gas topology bootstrap failed'
    );
  }

  return {
    deployer,
    treasuryManager,
    treasuryPool,
    gasPool,
  };
}
