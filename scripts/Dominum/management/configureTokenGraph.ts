import {
  Address,
  toNano,
} from '@ton/core';
import {
  NetworkProvider,
} from '@ton/blueprint';

import {
  DEPLOY_VALUES,
} from '../core/config';
import {
  buildTypedPlaceholderAddress,
} from '../core/helpers';
import {
  TokenGraphContracts,
} from '../core/types';
import {
  GIVER_TARGET,
} from '../../../wrappers/Dominum/core/constants';

import { configureGiverWallets } from './configureGiverWallets';

function requireSenderAddress(
  provider: NetworkProvider
): Address {
  const senderAddress = provider.sender().address;

  if (!senderAddress) {
    throw new Error('Sender address is not available');
  }

  return senderAddress;
}

export async function requestInitialMinter(
  provider: NetworkProvider,
  graph: TokenGraphContracts,
  queryId = 31n
): Promise<void> {
  const senderAddress = requireSenderAddress(provider);
  const managerOwner =
    await graph.minterManager.getMinterManagerData();

  if (!senderAddress.equals(managerOwner)) {
    throw new Error(
      'Minter request must be signed by MinterManager owner'
    );
  }

  await graph.minterManager.sendReplaceMinter(
    provider.sender(),
    {
      value: toNano(DEPLOY_VALUES.roleConfig),
      masterAddress: graph.domMaster.address,
      oldMinterAddress: buildTypedPlaceholderAddress(20, 1),
      newMinterAddress: graph.minter.address,
      queryId,
    }
  );
}

export async function requestInitialGiver(
  provider: NetworkProvider,
  graph: TokenGraphContracts,
  targetKind: number,
  queryId: bigint
): Promise<void> {
  const senderAddress = requireSenderAddress(provider);
  const managerOwner =
    await graph.giverManager.getManagerData();

  if (!senderAddress.equals(managerOwner)) {
    throw new Error(
      'Giver request must be signed by GiverManager owner'
    );
  }

  let newGiverAddress: Address;

  if (targetKind === GIVER_TARGET.allodium) {
    newGiverAddress = graph.giverAllodium.address;
  } else if (targetKind === GIVER_TARGET.defi) {
    newGiverAddress = graph.giverDefi.address;
  } else if (targetKind === GIVER_TARGET.dao) {
    newGiverAddress = graph.giverDao.address;
  } else if (targetKind === GIVER_TARGET.dominum) {
    newGiverAddress = graph.giverDominum.address;
  } else {
    throw new Error('Unknown Giver targetKind');
  }

  await graph.giverManager.sendReplaceGiver(
    provider.sender(),
    {
      value: toNano(DEPLOY_VALUES.roleConfig),
      masterAddress: graph.domMaster.address,
      targetKind,
      oldGiverAddress: buildTypedPlaceholderAddress(
        21,
        targetKind
      ),
      newGiverAddress,
      queryId,
    }
  );
}

export async function requestMinterManagerReplacement(
  provider: NetworkProvider,
  graph: TokenGraphContracts,
  newManagerAddress: Address,
  queryId: bigint
): Promise<void> {
  const senderAddress = requireSenderAddress(provider);
  const managerOwner =
    await graph.minterManager.getMinterManagerData();

  if (!senderAddress.equals(managerOwner)) {
    throw new Error(
      'MinterManager replacement must be signed by its owner'
    );
  }

  await graph.minterManager.sendReplaceManager(
    provider.sender(),
    {
      value: toNano(DEPLOY_VALUES.roleConfig),
      masterAddress: graph.domMaster.address,
      oldManagerAddress: graph.minterManager.address,
      newManagerAddress,
      queryId,
    }
  );
}

export async function requestGiverManagerReplacement(
  provider: NetworkProvider,
  graph: TokenGraphContracts,
  newManagerAddress: Address,
  queryId: bigint
): Promise<void> {
  const senderAddress = requireSenderAddress(provider);
  const managerOwner =
    await graph.giverManager.getManagerData();

  if (!senderAddress.equals(managerOwner)) {
    throw new Error(
      'GiverManager replacement must be signed by its owner'
    );
  }

  await graph.giverManager.sendReplaceManager(
    provider.sender(),
    {
      value: toNano(DEPLOY_VALUES.roleConfig),
      masterAddress: graph.domMaster.address,
      oldManagerAddress: graph.giverManager.address,
      newManagerAddress,
      queryId,
    }
  );
}

export async function confirmCurrentMasterRequest(
  provider: NetworkProvider,
  graph: TokenGraphContracts,
  queryId: bigint
): Promise<void> {
  const senderAddress = requireSenderAddress(provider);
  const masterData = await graph.domMaster.getMasterData();

  if (!senderAddress.equals(masterData.ownerAddress)) {
    throw new Error(
      'Master request confirmation must be signed by Master owner'
    );
  }

  await graph.domMaster.sendConfirmMasterRequest(
    provider.sender(),
    {
      value: toNano(DEPLOY_VALUES.roleConfig),
      queryId,
    }
  );
}

export async function rejectCurrentMasterRequest(
  provider: NetworkProvider,
  graph: TokenGraphContracts,
  queryId: bigint
): Promise<void> {
  const senderAddress = requireSenderAddress(provider);
  const masterData = await graph.domMaster.getMasterData();

  if (!senderAddress.equals(masterData.ownerAddress)) {
    throw new Error(
      'Master request rejection must be signed by Master owner'
    );
  }

  await graph.domMaster.sendRejectMasterRequest(
    provider.sender(),
    {
      value: toNano(DEPLOY_VALUES.roleConfig),
      queryId,
    }
  );
}

export async function configureTokenGraph(
  provider: NetworkProvider,
  graph: TokenGraphContracts
): Promise<void> {
  await configureGiverWallets(
    provider,
    graph
  );

  provider.ui().write(
    'Изменения ролей и GasPool выполняются отдельными запросами и подтверждениями разных signer-кошельков.'
  );
}
