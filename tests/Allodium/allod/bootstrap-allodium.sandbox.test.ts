/// <reference types="jest" />

import { compile } from '@ton/blueprint';
import { Blockchain } from '@ton/sandbox';
import { Cell } from '@ton/core';
import {
  AllodiumFoundation,
} from '../../../wrappers/Allodium/foundation/AllodiumFoundation';
import {
  FrsAllodium,
} from '../../../wrappers/Allodium/treasury/FrsAllodium';
import {
  ALLODIUM_METADATA_URL,
  AllodiumBootstrapConfig,
} from '../../../scripts/Allodium/core/config';
import {
  buildOffChainContent,
} from '../../../scripts/Allodium/core/helpers';
import {
  planAllodiumBootstrap,
} from '../../../scripts/Allodium/allod/deployAllodium';
import {
  CompiledAllodiumContracts,
} from '../../../scripts/Allodium/core/types';
import {
  ALLODIUM_COMPILE,
  ALLODIUM_FIXTURE,
  ALLODIUM_QUERY,
  ALLODIUM_VALUE,
  calculateAllodFromDom,
} from '../_helpers/allodium-test-values';
import {
  expectAddress,
  ignoreFailure,
} from '../../Dominum/core/dom-test-utils';

async function compileBootstrap():
Promise<CompiledAllodiumContracts> {
  const [
    allodMasterCode,
    allodWalletCode,
    allodGasPoolCode,
    frsAllodiumCode,
    allodiumFoundationCode,
  ]: Cell[] = await Promise.all([
    compile(ALLODIUM_COMPILE.master),
    compile(ALLODIUM_COMPILE.wallet),
    compile(ALLODIUM_COMPILE.allodGasPool),
    compile(ALLODIUM_COMPILE.frsAllodium),
    compile(ALLODIUM_COMPILE.foundation),
  ]);

  return {
    allodMasterCode,
    allodWalletCode,
    allodGasPoolCode,
    frsAllodiumCode,
    allodiumFoundationCode,
  };
}

describe('Allodium bootstrap', () => {
  it('resolves Master and FRS cycle before DOM allowance', async () => {
    const blockchain = await Blockchain.create();
    const compiled = await compileBootstrap();
    const deployer = await blockchain.treasury('deployer');
    const masterOwner = await blockchain.treasury('master-owner');
    const gasAuthority = await blockchain.treasury('gas-authority');
    const frsOwner = await blockchain.treasury('frs-owner');
    const foundationOwner = await blockchain.treasury(
      'foundation-owner'
    );
    const domWallet = await blockchain.treasury('dom-wallet');
    const giverAllodium = await blockchain.treasury('giver-allodium');
    const replacement = await blockchain.treasury('replacement-frs');
    const config: AllodiumBootstrapConfig = {
      masterOwner: masterOwner.address,
      gasPoolAuthority: gasAuthority.address,
      metadataUrl: ALLODIUM_METADATA_URL,
    };
    const plan = planAllodiumBootstrap(compiled, config);
    const allodGasPool = blockchain.openContract(plan.allodGasPool);
    const allodMaster = blockchain.openContract(plan.allodMaster);

    await allodGasPool.sendDeploy(
      deployer.getSender(),
      ALLODIUM_VALUE.deployGasPool
    );
    await allodMaster.sendDeploy(
      deployer.getSender(),
      ALLODIUM_VALUE.deploySmall
    );

    const foundation = blockchain.openContract(
      AllodiumFoundation.createFromConfig(
        {
          ownerAddress: foundationOwner.address,
          domWalletAddress: domWallet.address,
          walletConfigured: true,
        },
        compiled.allodiumFoundationCode
      )
    );
    const frs = blockchain.openContract(
      FrsAllodium.createFromConfig(
        {
          ownerAddress: frsOwner.address,
          domWalletAddress: domWallet.address,
          allodMasterAddress: allodMaster.address,
          giverAllodiumAddress: giverAllodium.address,
          allodiumFoundationAddress: foundation.address,
          giverConfigured: true,
          walletConfigured: true,
        },
        compiled.frsAllodiumCode
      )
    );

    await foundation.sendDeploy(
      deployer.getSender(),
      ALLODIUM_VALUE.deploySmall
    );
    await frs.sendDeploy(
      deployer.getSender(),
      ALLODIUM_VALUE.deploySmall
    );

    let masterData = await allodMaster.getMasterData();
    const jettonData = await allodMaster.getJettonData();
    expect(masterData.frsConfigured).toBe(false);
    expect(jettonData.content.hash().equals(
      buildOffChainContent(ALLODIUM_METADATA_URL).hash()
    )).toBe(true);

    await allodMaster.sendInitFrs(
      masterOwner.getSender(),
      {
        value: ALLODIUM_VALUE.config,
        frsAddress: frs.address,
        queryId: ALLODIUM_QUERY.initFrs,
      }
    );
    await allodGasPool.sendInitMasterConfig(
      gasAuthority.getSender(),
      {
        value: ALLODIUM_VALUE.config,
        masterAddress: allodMaster.address,
        jettonWalletCode: compiled.allodWalletCode,
        queryId: ALLODIUM_QUERY.allodGasInitMaster,
      }
    );

    await frs.sendDomTransferNotification(
      domWallet.getSender(),
      {
        value: ALLODIUM_VALUE.service,
        amount: ALLODIUM_FIXTURE.lockedDomAmount,
        fromAddress: giverAllodium.address,
        queryId: ALLODIUM_QUERY.domLocked,
      }
    );

    masterData = await allodMaster.getMasterData();
    const gasData = await allodGasPool.getAllodGasPoolData();
    expect(masterData.frsConfigured).toBe(true);
    expectAddress(masterData.frsAddress, frs.address);
    expectAddress(masterData.gasPoolAddress, allodGasPool.address);
    expect(masterData.mintAllowancePool).toEqual(
      calculateAllodFromDom(ALLODIUM_FIXTURE.lockedDomAmount)
    );
    expect(gasData.masterConfigured).toBe(true);
    expectAddress(gasData.masterAddress, allodMaster.address);

    await ignoreFailure(
      allodMaster.sendInitFrs(
        masterOwner.getSender(),
        {
          value: ALLODIUM_VALUE.config,
          frsAddress: replacement.address,
          queryId: ALLODIUM_QUERY.initFrsRejected,
        }
      )
    );

    expectAddress(
      (await allodMaster.getMasterData()).frsAddress,
      frs.address
    );
  });
});
