import { toNano } from '@ton/core';
import {
  NetworkProvider,
} from '@ton/blueprint';

import {
  DEPLOY_VALUES,
  FORWARDED_MESSAGE_WAIT_MS,
} from '../core/config';
import {
  buildTypedPlaceholderAddress,
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
  const sender = provider.sender();
  const senderAddress = requireSenderAddress(provider);
  const managerOwner =
    await infrastructure.treasuryManager.getTreasuryManagerData();

  if (!senderAddress.equals(managerOwner)) {
    throw new Error(
      'GasPool replacement request must be signed by TreasuryManager owner'
    );
  }

  await infrastructure.treasuryManager.sendReplaceTreasuryAddress(
    sender,
    {
      value: toNano(DEPLOY_VALUES.treasuryConfig),
      treasuryPoolAddress: infrastructure.treasuryPool.address,
      targetKind: TREASURY_TARGET.gasPool,
      oldAddress: buildTypedPlaceholderAddress(1, 4),
      newAddress: infrastructure.gasPool.address,
      queryId: 51n,
    }
  );

  await provider.waitForLastTransaction();
  await sleep(FORWARDED_MESSAGE_WAIT_MS);

  ui.write('TreasuryManager отправил запрос на замену GasPool.');
}

export async function confirmGasPoolReplacement(
  provider: NetworkProvider,
  infrastructure: InfrastructureContracts
): Promise<void> {
  const ui = provider.ui();
  const sender = provider.sender();
  const senderAddress = requireSenderAddress(provider);
  const treasuryData =
    await infrastructure.treasuryPool.getTreasuryPoolData();

  if (!senderAddress.equals(treasuryData.ownerAddress)) {
    throw new Error(
      'GasPool replacement confirmation must be signed by TreasuryPool owner'
    );
  }

  await infrastructure.treasuryPool.sendConfirmRequest(
    sender,
    {
      value: toNano(DEPLOY_VALUES.treasuryConfig),
      queryId: 52n,
    }
  );

  await provider.waitForLastTransaction();

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

  // Инициализация Master и кошелька разрешена только после отдельного подтверждения GasPool.
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
    `Газовый конвейер настроен. TreasuryPool wallet: ${treasuryWalletAddress.toString()}`
  );
}
