import { toNano } from '@ton/core';
import {
  NetworkProvider,
} from '@ton/blueprint';

import {
  DEPLOY_VALUES,
  FORWARDED_MESSAGE_WAIT_MS,
} from '../core/config';
import { sleep } from '../core/helpers';
import {
  CompiledContracts,
  InfrastructureContracts,
  TokenGraphContracts,
} from '../core/types';

export async function configureGasPipeline(
  provider: NetworkProvider,
  compiled: CompiledContracts,
  infrastructure: InfrastructureContracts,
  graph: TokenGraphContracts
): Promise<void> {
  const ui = provider.ui();
  const sender = provider.sender();

  ui.write('--- Step 10: Connect TreasuryPool to real GasPool ---');

  await infrastructure.treasuryManager.sendReplaceTreasuryAddress(
    sender,
    {
      value: toNano(DEPLOY_VALUES.treasuryConfig),
      treasuryPoolAddress: infrastructure.treasuryPool.address,
      oldAddress: infrastructure.deployer,
      newAddress: infrastructure.gasPool.address,
      queryId: 51n,
    }
  );

  await provider.waitForLastTransaction();
  await sleep(FORWARDED_MESSAGE_WAIT_MS);

  await infrastructure.treasuryPool.sendConfirmRequest(
    sender,
    {
      value: toNano(DEPLOY_VALUES.treasuryConfig),
      queryId: 52n,
    }
  );

  await provider.waitForLastTransaction();

  ui.write('TreasuryPool now points to real GasPool.');

  ui.write('--- Step 11: Init GasPool master config ---');

  await infrastructure.treasuryPool.sendInitMasterConfig(
    sender,
    {
      value: toNano(DEPLOY_VALUES.gasPipeline),
      masterAddress: graph.domMaster.address,
      jettonWalletCode: compiled.walletCode,
      queryId: 53n,
    }
  );

  await provider.waitForLastTransaction();
  await sleep(FORWARDED_MESSAGE_WAIT_MS);

  ui.write('GasPool master config initialized.');

  ui.write('--- Step 12: Init TreasuryPool DOM wallet ---');

  const treasuryWalletAddress =
    await graph.domMaster.getWalletAddress(
      infrastructure.treasuryPool.address
    );

  await infrastructure.treasuryPool.sendInitTreasuryWalletConfig(
    sender,
    {
      value: toNano(DEPLOY_VALUES.treasuryConfig),
      jettonWalletAddress: treasuryWalletAddress,
      queryId: 54n,
    }
  );

  await provider.waitForLastTransaction();

  ui.write(
    `TreasuryPool wallet: ${treasuryWalletAddress.toString()}`
  );
}