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

  ui.write('Step 9: First mint');
  ui.write(`Minting ${FIRST_MINT_AMOUNT.toString()} Dom units`);

  await graph.domMaster.sendMint(sender, {
    value: toNano(DEPLOY_VALUES.mint),
    amount: FIRST_MINT_AMOUNT,
    queryId: 21n,
  });

  await provider.waitForLastTransaction();

  const jettonData = await graph.domMaster.getJettonData();

  ui.write('MINT SENT');
  ui.write(`Total supply: ${jettonData.totalSupply.toString()}`);
  ui.write('');

  ui.write('DEPLOYED ADDRESSES');
  ui.write(`DomMaster: ${graph.domMaster.address.toString()}`);
  ui.write(`GasProxy: ${infrastructure.gasProxy.address.toString()}`);
  ui.write(`GasPool: ${infrastructure.gasPool.address.toString()}`);
  ui.write(`GiverManager ${graph.giverManager.address.toString()}`);
  ui.write(`GiverAllodium: ${graph.giverAllodium.address.toString()}`);
  ui.write(`GiverDefi: ${graph.giverDefi.address.toString()}`);
  ui.write(`GiverDao: ${graph.giverDao.address.toString()}`);
  ui.write(`GiverDominum: ${graph.giverDominum.address.toString()}`);
}