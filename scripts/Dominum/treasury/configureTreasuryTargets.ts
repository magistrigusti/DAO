import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { DEPLOY_VALUES } from '../core/config';
import { buildTypedPlaceholderAddress } from '../core/helpers';
import { InfrastructureContracts } from '../core/types';

function requireSenderAddress(provider: NetworkProvider): Address {
  const senderAddress = provider.sender().address;

  if (!senderAddress) {
    throw new Error('Sender address is not available');
  }

  return senderAddress;
}

export async function requestTreasuryTargetReplacement(
  provider: NetworkProvider,
  infrastructure: InfrastructureContracts,
  targetKind: number,
  newAddress: Address,
  queryId: bigint
): Promise<void> {
  const senderAddress = requireSenderAddress(provider);
  const managerOwner =
    await infrastructure.treasuryManager.getTreasuryManagerData();

  if (!senderAddress.equals(managerOwner)) {
    throw new Error(
      'Treasury request must be signed by TreasuryManager owner'
    );
  }

  await infrastructure.treasuryManager.sendReplaceTreasuryAddress(
    provider.sender(),
    {
      value: toNano(DEPLOY_VALUES.treasuryConfig),
      treasuryPoolAddress: infrastructure.treasuryPool.address,
      targetKind,
      oldAddress: buildTypedPlaceholderAddress(1, targetKind),
      newAddress,
      queryId,
    }
  );

  await provider.waitForLastTransaction();
}

export async function confirmTreasuryTargetReplacement(
  provider: NetworkProvider,
  infrastructure: InfrastructureContracts,
  queryId: bigint
): Promise<void> {
  const senderAddress = requireSenderAddress(provider);
  const treasuryData =
    await infrastructure.treasuryPool.getTreasuryPoolData();

  if (!senderAddress.equals(treasuryData.ownerAddress)) {
    throw new Error(
      'Treasury confirmation must be signed by TreasuryPool owner'
    );
  }

  await infrastructure.treasuryPool.sendConfirmRequest(
    provider.sender(),
    {
      value: toNano(DEPLOY_VALUES.treasuryConfig),
      queryId,
    }
  );

  await provider.waitForLastTransaction();
}
