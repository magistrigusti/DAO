import { Address, toNano } from '@ton/core';
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
import {
  DEPLOY_VALUES,
  DomPreGraphDistributionAddresses,
  DomRecipientDependencies,
  DomRecipientOwnerAddresses,
  RECIPIENT_PLACEHOLDER_NAMESPACE,
} from '../core/config';
import { buildTypedPlaceholderAddress } from '../core/helpers';
import {
  CompiledContracts,
  PreGraphRecipientContracts,
} from '../core/types';

type RecipientPlan = {
  frsAllodium: FrsAllodium;
  allodiumFoundation: AllodiumFoundation;
  defiMarket: MarketMaker;
  defiFoundry: FoundryLock;
  defiTreasury: BankDefi;
  daoBank: BankDao;
  daoFoundation: DaoFoundation;
  dominumFoundation: DominumFoundation;
};

type RecipientCompiledContracts = Pick<
  CompiledContracts,
  | 'frsAllodiumCode'
  | 'allodiumFoundationCode'
  | 'marketMakerCode'
  | 'foundryLockCode'
  | 'bankDefiCode'
  | 'bankDaoCode'
  | 'daoFoundationCode'
  | 'dominumFoundationCode'
>;

function placeholder(target: number): Address {
  return buildTypedPlaceholderAddress(
    RECIPIENT_PLACEHOLDER_NAMESPACE,
    target
  );
}

export function planPreGraphRecipients(
  compiled: RecipientCompiledContracts,
  owners: DomRecipientOwnerAddresses,
  dependencies: DomRecipientDependencies
): RecipientPlan {
  const allodiumFoundation = AllodiumFoundation.createFromConfig(
    {
      ownerAddress: owners.allodiumFoundationOwner,
      domWalletAddress: placeholder(1),
      walletConfigured: false,
    },
    compiled.allodiumFoundationCode
  );
  const defiMarket = MarketMaker.createFromConfig(
    {
      ownerAddress: owners.marketOwner,
      walletAddress: placeholder(2),
      defiBankAddress: placeholder(20),
      defiFoundationAddress: dependencies.defiFoundation,
      bankConfigured: false,
      walletConfigured: false,
    },
    compiled.marketMakerCode
  );
  const defiTreasury = BankDefi.createFromConfig(
    {
      ownerAddress: owners.defiBankOwner,
      walletAddress: placeholder(3),
      walletConfigured: false,
      defiFoundationAddress: dependencies.defiFoundation,
      marketMakerAddress: defiMarket.address,
    },
    compiled.bankDefiCode
  );
  const defiFoundry = FoundryLock.createFromConfig(
    {
      ownerAddress: owners.foundryOwner,
      walletAddress: placeholder(4),
      walletConfigured: false,
      releaseAddress: dependencies.foundryRelease,
    },
    compiled.foundryLockCode
  );
  const daoBank = BankDao.createFromConfig(
    {
      ownerAddress: owners.daoBankOwner,
      walletAddress: placeholder(5),
      walletConfigured: false,
    },
    compiled.bankDaoCode
  );
  const daoFoundation = DaoFoundation.createFromConfig(
    {
      ownerAddress: owners.daoFoundationOwner,
      walletAddress: placeholder(6),
      walletConfigured: false,
    },
    compiled.daoFoundationCode
  );
  const dominumFoundation = DominumFoundation.createFromConfig(
    {
      ownerAddress: owners.dominumFoundationOwner,
      walletAddress: placeholder(7),
      walletConfigured: false,
    },
    compiled.dominumFoundationCode
  );
  const frsAllodium = FrsAllodium.createFromConfig(
    {
      ownerAddress: owners.frsOwner,
      domWalletAddress: placeholder(8),
      allodMasterAddress: dependencies.allodMaster,
      giverAllodiumAddress: placeholder(21),
      allodiumFoundationAddress: allodiumFoundation.address,
      giverConfigured: false,
      walletConfigured: false,
    },
    compiled.frsAllodiumCode
  );

  return {
    frsAllodium,
    allodiumFoundation,
    defiMarket,
    defiFoundry,
    defiTreasury,
    daoBank,
    daoFoundation,
    dominumFoundation,
  };
}

export function preGraphAddresses(
  plan: RecipientPlan
): DomPreGraphDistributionAddresses {
  return {
    frsAllodium: plan.frsAllodium.address,
    allodiumFoundation: plan.allodiumFoundation.address,
    defiMarket: plan.defiMarket.address,
    defiFoundry: plan.defiFoundry.address,
    defiTreasury: plan.defiTreasury.address,
    daoBank: plan.daoBank.address,
    daoFoundation: plan.daoFoundation.address,
    dominumFoundation: plan.dominumFoundation.address,
  };
}

export async function deployPreGraphRecipients(
  provider: NetworkProvider,
  compiled: RecipientCompiledContracts,
  owners: DomRecipientOwnerAddresses,
  dependencies: DomRecipientDependencies
): Promise<PreGraphRecipientContracts> {
  const plan = planPreGraphRecipients(compiled, owners, dependencies);
  const opened: PreGraphRecipientContracts = {
    frsAllodium: provider.open(plan.frsAllodium),
    allodiumFoundation: provider.open(plan.allodiumFoundation),
    defiMarket: provider.open(plan.defiMarket),
    defiFoundry: provider.open(plan.defiFoundry),
    defiTreasury: provider.open(plan.defiTreasury),
    daoBank: provider.open(plan.daoBank),
    daoFoundation: provider.open(plan.daoFoundation),
    dominumFoundation: provider.open(plan.dominumFoundation),
  };
  const entries = Object.entries(opened);

  for (const [label, contract] of entries) {
    provider.ui().write(`Deploying recipient ${label}`);
    await contract.sendDeploy(
      provider.sender(),
      toNano(DEPLOY_VALUES.recipient)
    );
    await provider.waitForDeploy(contract.address);
  }

  return opened;
}

export function planDominumBank(
  code: CompiledContracts['bankDominumCode'],
  ownerAddress: Address,
  gasPoolAddress: Address
) : BankDominum {
  return BankDominum.createFromConfig(
    {
      ownerAddress,
      gasPoolAddress,
      domWalletAddress: placeholder(9),
      walletConfigured: false,
    },
    code
  );
}

export async function deployDominumBank(
  provider: NetworkProvider,
  code: CompiledContracts['bankDominumCode'],
  ownerAddress: Address,
  gasPoolAddress: Address
) {
  const contract = provider.open(
    planDominumBank(code, ownerAddress, gasPoolAddress)
  );

  await contract.sendDeploy(
    provider.sender(),
    toNano(DEPLOY_VALUES.recipient)
  );
  await provider.waitForDeploy(contract.address);
  return contract;
}
