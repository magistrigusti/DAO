import { toNano } from '@ton/core';
import {
  NetworkProvider,
} from '@ton/blueprint';

import {
  DEPLOY_VALUES,
  FORWARDED_MESSAGE_WAIT_MS,
} from '../core/config';
import {
  sleep,
} from '../core/helpers';
import {
  CompiledContracts,
  InfrastructureContracts,
  TokenGraphContracts,
} from '../core/types';
import {
  TREASURY_TARGET,
} from '../../../wrappers/Dominum/core/constants';
import {
  confirmTreasuryTargetReplacement,
  requestTreasuryTargetReplacement,
} from './configureTreasuryTargets';

function requireSenderAddress(
  provider: NetworkProvider
) {
  const senderAddress = provider.sender().address;

  if (!senderAddress) {
    throw new Error('Sender address is not available');
  }

  return senderAddress;
}

export async function requestGasPoolReplacement(
  provider: NetworkProvider,
  infrastructure: InfrastructureContracts
): Promise<void> {
  const ui = provider.ui();
  await requestTreasuryTargetReplacement(
    provider,
    infrastructure,
    TREASURY_TARGET.gasPool,
    infrastructure.gasPool.address,
    51n
  );
  await sleep(FORWARDED_MESSAGE_WAIT_MS);

  ui.write(
    'TreasuryManager отправил запрос на замену GasPool.'
  );
}

export async function confirmGasPoolReplacement(
  provider: NetworkProvider,
  infrastructure: InfrastructureContracts
): Promise<void> {
  const ui = provider.ui();
  await confirmTreasuryTargetReplacement(
    provider,
    infrastructure,
    52n
  );

  ui.write('TreasuryPool подтвердил новый GasPool.');
}

export async function initializeGasPipeline(
  provider: NetworkProvider,
  compiled: CompiledContracts,
  infrastructure: InfrastructureContracts,
  graph: TokenGraphContracts
): Promise<void> {
  const ui = provider.ui();
  const sender = provider.sender();
  const senderAddress = requireSenderAddress(provider);
  const treasuryData =
    await infrastructure.treasuryPool.getTreasuryPoolData();

  if (!senderAddress.equals(treasuryData.ownerAddress)) {
    throw new Error(
      'Gas pipeline initialization must be signed by TreasuryPool owner'
    );
  }

  if (!treasuryData.gasPoolAddress.equals(infrastructure.gasPool.address)) {
    throw new Error(
      'GasPool replacement must be confirmed before pipeline initialization'
    );
  }

  // Master и кошелек разрешено связать только после подтверждения GasPool.
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
    'Газовый конвейер настроен. TreasuryPool wallet: ' +
    treasuryWalletAddress.toString()
  );
}
