import { Address, OpenedContract, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { DomMaster } from '../../../wrappers/Dominum/dom/DomMaster';
import {
  DEPLOY_VALUES,
  FORWARDED_MESSAGE_WAIT_MS,
} from '../core/config';
import { sleep } from '../core/helpers';
import { DomRecipientContracts } from '../core/types';

function requireSender(
  provider: NetworkProvider,
  expected: Address,
  label: string
): void {
  const senderAddress = provider.sender().address;

  if (!senderAddress || !senderAddress.equals(expected)) {
    throw new Error(`${label} must be signed by its configured owner`);
  }
}

async function recipientWallet(
  master: OpenedContract<DomMaster>,
  owner: Address
): Promise<Address> {
  return master.getWalletAddress(owner);
}

export async function configureRecipientAction(
  provider: NetworkProvider,
  master: OpenedContract<DomMaster>,
  recipients: DomRecipientContracts,
  action: string
): Promise<void> {
  const value = toNano(DEPLOY_VALUES.recipientConfig);

  if (action === 'frs-giver') {
    const data = await recipients.frsAllodium.getFrsData();
    requireSender(provider, data.ownerAddress, 'FRS giver initialization');
    await recipients.frsAllodium.sendInitGiver(provider.sender(), {
      value,
      giverAddress: await activeGiverAddress(master),
      queryId: 71n,
    });
  } else if (action === 'frs-wallet') {
    const data = await recipients.frsAllodium.getFrsData();
    requireSender(provider, data.ownerAddress, 'FRS wallet initialization');
    await recipients.frsAllodium.sendInitWallet(provider.sender(), {
      value,
      walletAddress: await recipientWallet(
        master,
        recipients.frsAllodium.address
      ),
      queryId: 72n,
    });
  } else if (action === 'allodium-foundation-wallet') {
    const data = await recipients.allodiumFoundation.getFoundationData();
    requireSender(provider, data.ownerAddress, 'Allodium Foundation wallet');
    await recipients.allodiumFoundation.sendInitWallet(provider.sender(), {
      value,
      walletAddress: await recipientWallet(
        master,
        recipients.allodiumFoundation.address
      ),
      queryId: 73n,
    });
  } else if (action === 'defi-market-bank') {
    const data = await recipients.defiMarket.getMarketData();
    requireSender(provider, data.ownerAddress, 'DeFi Market bank');
    await recipients.defiMarket.sendInitDefiBank(provider.sender(), {
      value,
      bankAddress: recipients.defiTreasury.address,
      queryId: 74n,
    });
  } else if (action === 'defi-market-wallet') {
    const data = await recipients.defiMarket.getMarketData();
    requireSender(provider, data.ownerAddress, 'DeFi Market wallet');
    await recipients.defiMarket.sendInitWallet(provider.sender(), {
      value,
      walletAddress: await recipientWallet(
        master,
        recipients.defiMarket.address
      ),
      queryId: 75n,
    });
  } else if (action === 'defi-foundry-wallet') {
    const data = await recipients.defiFoundry.getFoundryLockData();
    requireSender(provider, data.ownerAddress, 'DeFi Foundry wallet');
    await recipients.defiFoundry.sendInitWallet(provider.sender(), {
      value,
      walletAddress: await recipientWallet(
        master,
        recipients.defiFoundry.address
      ),
      queryId: 76n,
    });
  } else if (action === 'defi-treasury-wallet') {
    const data = await recipients.defiTreasury.getDefiBankData();
    requireSender(provider, data.ownerAddress, 'DeFi Treasury wallet');
    await recipients.defiTreasury.sendInitWallet(provider.sender(), {
      value,
      walletAddress: await recipientWallet(
        master,
        recipients.defiTreasury.address
      ),
      queryId: 77n,
    });
  } else if (action === 'dao-bank-wallet') {
    const data = await recipients.daoBank.getBankData();
    requireSender(provider, data.ownerAddress, 'DAO Bank wallet');
    await recipients.daoBank.sendInitWalletConfig(provider.sender(), {
      value,
      walletAddress: await recipientWallet(
        master,
        recipients.daoBank.address
      ),
      queryId: 78n,
    });
  } else if (action === 'dao-foundation-wallet') {
    const data = await recipients.daoFoundation.getFoundationData();
    requireSender(provider, data.ownerAddress, 'DAO Foundation wallet');
    await recipients.daoFoundation.sendInitWallet(provider.sender(), {
      value,
      walletAddress: await recipientWallet(
        master,
        recipients.daoFoundation.address
      ),
      queryId: 79n,
    });
  } else if (action === 'dominum-bank-wallet') {
    const data = await recipients.dominumBank.getBankDominumData();
    requireSender(provider, data.ownerAddress, 'Dominum Bank wallet');
    await recipients.dominumBank.sendInitWallet(provider.sender(), {
      value,
      walletAddress: await recipientWallet(
        master,
        recipients.dominumBank.address
      ),
      queryId: 80n,
    });
  } else if (action === 'dominum-foundation-wallet') {
    const data = await recipients.dominumFoundation.getFoundationData();
    requireSender(provider, data.ownerAddress, 'Dominum Foundation wallet');
    await recipients.dominumFoundation.sendInitWallet(provider.sender(), {
      value,
      walletAddress: await recipientWallet(
        master,
        recipients.dominumFoundation.address
      ),
      queryId: 81n,
    });
  } else {
    throw new Error(`Unknown DOM_RECIPIENT_ACTION: ${action}`);
  }

  await provider.waitForLastTransaction();
  await sleep(FORWARDED_MESSAGE_WAIT_MS);
}

async function activeGiverAddress(
  master: OpenedContract<DomMaster>
): Promise<Address> {
  const givers = await master.getGiversData();
  return givers.giverAllodiumAddress;
}
