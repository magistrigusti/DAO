import { toNano } from '@ton/core';
import {
  NetworkProvider,
} from '@ton/blueprint';

import {
  DEPLOY_VALUES,
  FIRST_MINT_AMOUNT,
} from '../core/config';
import {
  InfrastructureContracts,
  TokenGraphContracts,
} from '../core/types';

export async function mintAndReport(
  provider: NetworkProvider,
  infrastructure: InfrastructureContracts,
  graph: TokenGraphContracts
): Promise<void> {
  const ui = provider.ui();
  const sender = provider.sender();

  ui.write('--- Step 14: First mint through Minter ---');
  ui.write(
    `Minting ${FIRST_MINT_AMOUNT.toString()} DOM units`
  );

  await graph.minter.sendMint(
    sender,
    {
      value: toNano(DEPLOY_VALUES.mint),
      amount: FIRST_MINT_AMOUNT,
      queryId: 61n,
    }
  );

  await provider.waitForLastTransaction();

  const jettonData = await graph.domMaster.getJettonData();
  const masterData = await graph.domMaster.getMasterData();
  const gasPoolData = await infrastructure.gasPool.getGasPoolData();
  const treasuryData =
    await infrastructure.treasuryPool.getTreasuryPoolData();

  ui.write('MINT SENT');
  ui.write(
    `Total supply: ${jettonData.totalSupply.toString()}`
  );
  ui.write(
    `Master started: ${masterData.isStarted ? 'yes' : 'no'}`
  );
  ui.write(
    `GasPool configured: ${gasPoolData.masterConfigured ? 'yes' : 'no'}`
  );
  ui.write(
    `Treasury wallet configured: ${treasuryData.walletConfigured ? 'yes' : 'no'}`
  );
  ui.write('');

  ui.write('DEPLOYED ADDRESSES');
  ui.write(
    `DomMaster: ${graph.domMaster.address.toString()}`
  );
  ui.write(
    `Minter: ${graph.minter.address.toString()}`
  );
  ui.write(
    `MinterManager: ${graph.minterManager.address.toString()}`
  );
  ui.write(
    `TreasuryManager: ${infrastructure.treasuryManager.address.toString()}`
  );
  ui.write(
    `TreasuryPool: ${infrastructure.treasuryPool.address.toString()}`
  );
  ui.write(
    `GasPool: ${infrastructure.gasPool.address.toString()}`
  );
  ui.write(
    `GiverManager: ${graph.giverManager.address.toString()}`
  );
  ui.write(
    `GiverAllodium: ${graph.giverAllodium.address.toString()}`
  );
  ui.write(
    `GiverDefi: ${graph.giverDefi.address.toString()}`
  );
  ui.write(
    `GiverDao: ${graph.giverDao.address.toString()}`
  );
  ui.write(
    `GiverDominum: ${graph.giverDominum.address.toString()}`
  );
}