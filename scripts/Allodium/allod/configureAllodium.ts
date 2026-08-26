import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { AllodMaster } from '../../../wrappers/Allodium/allod/AllodMaster';
import { AllodGasPool } from '../../../wrappers/Allodium/pools/AllodGasPool';
import {
  ALLODIUM_DEFAULTS,
  ALLODIUM_DEPLOY_VALUES,
  FORWARDED_MESSAGE_WAIT_MS,
  AllodiumBootstrapConfig,
  AllodiumDeploymentAddresses,
} from '../core/config';
import { sleep } from '../core/helpers';
import {
  AllodiumBootstrapContracts,
  CompiledAllodiumContracts,
} from '../core/types';

function requireSender(
  provider: NetworkProvider,
  expected: Address,
  label: string
): void {
  const actual = provider.sender().address;

  if (!actual || !actual.equals(expected)) {
    throw new Error(`${label} requires its configured signer`);
  }
}

export function openAllodiumBootstrap(
  provider: NetworkProvider,
  addresses: AllodiumDeploymentAddresses
): AllodiumBootstrapContracts {
  return {
    allodMaster: provider.open(
      AllodMaster.createFromAddress(addresses.allodMaster)
    ),
    allodGasPool: provider.open(
      AllodGasPool.createFromAddress(addresses.allodGasPool)
    ),
  };
}

async function waitForwarded(provider: NetworkProvider): Promise<void> {
  await provider.waitForLastTransaction();
  await sleep(FORWARDED_MESSAGE_WAIT_MS);
}

export async function configureAllodiumAction(
  provider: NetworkProvider,
  contracts: AllodiumBootstrapContracts,
  compiled: CompiledAllodiumContracts,
  config: AllodiumBootstrapConfig,
  addresses: AllodiumDeploymentAddresses,
  action: string
): Promise<void> {
  const sender = provider.sender();

  if (action === 'master-frs-init') {
    requireSender(provider, config.masterOwner, 'Master FRS init');
    await contracts.allodMaster.sendInitFrs(sender, {
      value: toNano(ALLODIUM_DEPLOY_VALUES.service),
      frsAddress: addresses.frsAllodium,
      queryId: 801n,
    });
  } else if (action === 'gas-master-init') {
    requireSender(provider, config.gasPoolAuthority, 'GasPool master init');
    await contracts.allodGasPool.sendInitMasterConfig(sender, {
      value: toNano(ALLODIUM_DEPLOY_VALUES.allodGasPoolConfig),
      masterAddress: contracts.allodMaster.address,
      jettonWalletCode: compiled.allodWalletCode,
      queryId: 802n,
    });
  } else if (action === 'gas-fee') {
    requireSender(provider, config.gasPoolAuthority, 'GasPool fee config');
    await contracts.allodGasPool.sendChangeTransferFee(sender, {
      value: toNano(ALLODIUM_DEPLOY_VALUES.service),
      newTransferFeeAllod: ALLODIUM_DEFAULTS.transferFeeAllod,
      queryId: 803n,
    });
  } else if (action === 'gas-top-up') {
    requireSender(provider, config.gasPoolAuthority, 'GasPool top up');
    await contracts.allodGasPool.sendTopUp(sender, {
      value: toNano(ALLODIUM_DEPLOY_VALUES.allodGasPoolTopUp),
      queryId: 804n,
    });
  } else {
    throw new Error(`Unknown ALLODIUM_CONFIG_ACTION: ${action}`);
  }

  await waitForwarded(provider);
}
