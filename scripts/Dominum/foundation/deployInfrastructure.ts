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

import { GasProxy } from '../../../wrappers/Dominum/treasury/GasProxy';
import { GasPool } from '../../../wrappers/Dominum/treasury/GasPool';

export async function deployInfrastructure(
  provider: NetworkProvider,
  compiled: CompiledContracts,
  deployer: Address
): Promise<InfrastructureContracts> {
  const ui = provider.ui();
  const sender = provider.sender();

  // ========== STEP 1: GAS PROXY ==========
  ui.write('--- Step 1: Deploy GasProxy ---');

  const gasProxy = provider.open(
      GasProxy.createFromConfig(
          {
              adminAddress: deployer,
              realGasPoolAddress: deployer,
          },
          compiled.gasProxyCode
      )
  );

  await gasProxy.sendDeploy(
      sender,
      toNano(DEPLOY_VALUES.gasProxy)
  );
  await provider.waitForDeploy(gasProxy.address);

  ui.write(
      `GasProxy: ${gasProxy.address.toString()}`
  );

  // ========== STEP 2: GAS POOL ==========
  ui.write('--- Step 2: Deploy GasPool ---');

  const gasPool = provider.open(
      GasPool.createFromConfig(
          {
              adminAddress: deployer,
              proxyAddress: gasProxy.address,
              domTreasuryAddress: deployer,
              domBalance: 0n,
              tonReserve: 0n,
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
      gasProxy,
      gasPool,
  };
}