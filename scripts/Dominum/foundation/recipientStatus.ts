import { Address, Cell, OpenedContract } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { FrsAllodium } from '../../../wrappers/Allodium/treasury/FrsAllodium';
import {
  AllodiumFoundation,
} from '../../../wrappers/Allodium/foundation/AllodiumFoundation';
import { MarketMaker } from '../../../wrappers/Dominum/defi/MarketMaker';
import { FoundryLock } from '../../../wrappers/Dominum/invest/FoundryLock';
import { BankDefi } from '../../../wrappers/Dominum/banks/BankDefi';
import { BankDao } from '../../../wrappers/Dominum/banks/BankDao';
import {
  DaoFoundation,
} from '../../../wrappers/Dominum/foundation/DaoFoundation';
import { BankDominum } from '../../../wrappers/Dominum/banks/BankDominum';
import {
  DominumFoundation,
} from '../../../wrappers/Dominum/foundation/DominumFoundation';
import { DomMaster } from '../../../wrappers/Dominum/dom/DomMaster';
import {
  DomDistributionAddresses,
  DomRecipientOwnerAddresses,
} from '../core/config';
import { DomRecipientContracts } from '../core/types';

type StatusCheck = { label: string; valid: boolean };

function same(actual: Address, expected: Address): boolean {
  return actual.equals(expected);
}

export function openDomRecipients(
  provider: NetworkProvider,
  distribution: DomDistributionAddresses
): DomRecipientContracts {
  return {
    frsAllodium: provider.open(
      FrsAllodium.createFromAddress(distribution.frsAllodium)
    ),
    allodiumFoundation: provider.open(
      AllodiumFoundation.createFromAddress(
        distribution.allodiumFoundation
      )
    ),
    defiMarket: provider.open(
      MarketMaker.createFromAddress(distribution.defiMarket)
    ),
    defiFoundry: provider.open(
      FoundryLock.createFromAddress(distribution.defiFoundry)
    ),
    defiTreasury: provider.open(
      BankDefi.createFromAddress(distribution.defiTreasury)
    ),
    daoBank: provider.open(
      BankDao.createFromAddress(distribution.daoBank)
    ),
    daoFoundation: provider.open(
      DaoFoundation.createFromAddress(distribution.daoFoundation)
    ),
    dominumBank: provider.open(
      BankDominum.createFromAddress(distribution.dominumBank)
    ),
    dominumFoundation: provider.open(
      DominumFoundation.createFromAddress(
        distribution.dominumFoundation
      )
    ),
  };
}

export async function printRecipientStatus(
  provider: NetworkProvider,
  master: OpenedContract<DomMaster>,
  recipients: DomRecipientContracts
): Promise<boolean> {
  const entries = Object.entries(recipients);
  const wallets = await Promise.all(
    entries.map(([, contract]) => master.getWalletAddress(contract.address))
  );
  const [
    frs,
    allodium,
    market,
    foundry,
    defiBank,
    daoBank,
    daoFoundation,
    dominumBank,
    dominumFoundation,
  ] = await Promise.all([
    recipients.frsAllodium.getFrsData(),
    recipients.allodiumFoundation.getFoundationData(),
    recipients.defiMarket.getMarketData(),
    recipients.defiFoundry.getFoundryLockData(),
    recipients.defiTreasury.getDefiBankData(),
    recipients.daoBank.getBankData(),
    recipients.daoFoundation.getFoundationData(),
    recipients.dominumBank.getBankDominumData(),
    recipients.dominumFoundation.getFoundationData(),
  ]);
  const checks: StatusCheck[] = [
    {
      label: 'FRS wallet',
      valid: frs.walletConfigured && same(frs.domWalletAddress, wallets[0]),
    },
    { label: 'FRS giver', valid: frs.giverConfigured },
    {
      label: 'Allodium Foundation wallet',
      valid: allodium.walletConfigured &&
        same(allodium.domWalletAddress, wallets[1]),
    },
    {
      label: 'DeFi Market wallet',
      valid: market.walletConfigured &&
        same(market.walletAddress, wallets[2]),
    },
    { label: 'DeFi Market bank', valid: market.bankConfigured },
    {
      label: 'DeFi Foundry wallet',
      valid: foundry.walletConfigured &&
        same(foundry.walletAddress, wallets[3]),
    },
    {
      label: 'DeFi Treasury wallet',
      valid: defiBank.walletConfigured &&
        same(defiBank.walletAddress, wallets[4]),
    },
    {
      label: 'DAO Bank wallet',
      valid: daoBank.walletConfigured &&
        same(daoBank.walletAddress, wallets[5]),
    },
    {
      label: 'DAO Foundation wallet',
      valid: daoFoundation.walletConfigured &&
        same(daoFoundation.walletAddress, wallets[6]),
    },
    {
      label: 'Dominum Bank wallet',
      valid: dominumBank.walletConfigured &&
        same(dominumBank.domWalletAddress, wallets[7]),
    },
    {
      label: 'Dominum Foundation wallet',
      valid: dominumFoundation.walletConfigured &&
        same(dominumFoundation.walletAddress, wallets[8]),
    },
  ];

  checks.forEach((check) => {
    provider.ui().write(`${check.label}: ${check.valid ? 'OK' : 'NO'}`);
  });

  return checks.every((check) => check.valid);
}

export async function deriveRecipientOwnerCodeHash(
  provider: NetworkProvider,
  owners: DomRecipientOwnerAddresses
): Promise<string> {
  const states = await Promise.all(
    Object.values(owners).map(
      (address) => provider.getContractState(address)
    )
  );
  const hashes = states.map((state) => {
    if (state.state.type !== 'active' || !state.state.code) {
      throw new Error('Every recipient owner must be an active wallet');
    }

    const cells = Cell.fromBoc(state.state.code);

    if (cells.length !== 1) {
      throw new Error('Recipient owner code must contain exactly one cell');
    }

    return cells[0].hash().toString('hex');
  });
  const unique = new Set(hashes);

  if (unique.size !== 1) {
    throw new Error('Recipient owner wallets use different code hashes');
  }

  return hashes[0];
}
