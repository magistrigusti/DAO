import { NetworkProvider } from '@ton/blueprint';
import { toNano } from '@ton/core';
import { AllodMaster } from '../../../wrappers/Allodium/allod/AllodMaster';
import { AllodGasPool } from '../../../wrappers/Allodium/pools/AllodGasPool';
import {
  ALLODIUM_DEFAULTS,
  ALLODIUM_DEPLOY_VALUES,
  AllodiumBootstrapConfig,
  buildAllodiumPlaceholderAddress,
} from '../core/config';
import { buildOffChainContent } from '../core/helpers';
import {
  AllodiumBootstrapContracts,
  AllodiumBootstrapPlan,
  CompiledAllodiumContracts,
} from '../core/types';

export function planAllodiumBootstrap(
  compiled: CompiledAllodiumContracts,
  config: AllodiumBootstrapConfig
): AllodiumBootstrapPlan {
  const allodGasPool = AllodGasPool.createFromConfig(
    {
      authorityAddress: config.gasPoolAuthority,
      masterAddress: buildAllodiumPlaceholderAddress(1),
      jettonWalletCode: compiled.allodWalletCode,
      masterConfigured: false,
      transferFeeAllod: ALLODIUM_DEFAULTS.transferFeeAllod,
    },
    compiled.allodGasPoolCode
  );
  const allodMaster = AllodMaster.createFromConfig(
    {
      totalSupply: 0n,
      ownerAddress: config.masterOwner,
      frsAddress: buildAllodiumPlaceholderAddress(2),
      frsConfigured: false,
      gasPoolAddress: allodGasPool.address,
      mintAllowancePool: 0n,
      content: buildOffChainContent(config.metadataUrl),
      jettonWalletCode: compiled.allodWalletCode,
    },
    compiled.allodMasterCode
  );

  return { allodGasPool, allodMaster };
}

export async function deployAllodiumBootstrap(
  provider: NetworkProvider,
  compiled: CompiledAllodiumContracts,
  config: AllodiumBootstrapConfig
): Promise<AllodiumBootstrapContracts> {
  const plan = planAllodiumBootstrap(compiled, config);
  const allodGasPool = provider.open(plan.allodGasPool);
  const allodMaster = provider.open(plan.allodMaster);

  provider.ui().write('Deploying AllodGasPool...');
  await allodGasPool.sendDeploy(
    provider.sender(),
    toNano(ALLODIUM_DEPLOY_VALUES.allodGasPool)
  );
  await provider.waitForDeploy(allodGasPool.address);

  provider.ui().write('Deploying AllodMaster...');
  await allodMaster.sendDeploy(
    provider.sender(),
    toNano(ALLODIUM_DEPLOY_VALUES.allodMaster)
  );
  await provider.waitForDeploy(allodMaster.address);

  const [gasData, masterData] = await Promise.all([
    allodGasPool.getAllodGasPoolData(),
    allodMaster.getMasterData(),
  ]);

  if (gasData.masterConfigured || masterData.frsConfigured) {
    throw new Error('Allodium bootstrap must start unconfigured');
  }

  return { allodGasPool, allodMaster };
}
