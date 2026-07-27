import { Address } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import {
  AllodiumFoundation,
} from '../../../wrappers/Allodium/foundation/AllodiumFoundation';
import {
  FrsAllodium,
} from '../../../wrappers/Allodium/treasury/FrsAllodium';
import { BankDao } from '../../../wrappers/Dominum/banks/BankDao';
import { BankDefi } from '../../../wrappers/Dominum/banks/BankDefi';
import {
  BankDominum,
} from '../../../wrappers/Dominum/banks/BankDominum';
import {
  MarketMaker,
} from '../../../wrappers/Dominum/defi/MarketMaker';
import {
  DaoFoundation,
} from '../../../wrappers/Dominum/foundation/DaoFoundation';
import {
  DominumFoundation,
} from '../../../wrappers/Dominum/foundation/DominumFoundation';
import {
  FoundryLock,
} from '../../../wrappers/Dominum/invest/FoundryLock';
import {
  DomDistributionAddresses,
  DomRecipientControls,
} from '../core/config';
import {
  CompiledContracts,
  InfrastructureContracts,
  TokenGraphContracts,
} from '../core/types';
import {
  assertAddress,
  assertRecipientTopologyAndCode,
} from './mintRouting';
function checkAddresses(
  checks: [Address, Address, string][]
): void {
  checks.forEach(([actual, expected, label]) => {
    assertAddress(actual, expected, label);
  });
}
function checkEmpty(values: bigint[], label: string): void {
  values.forEach((value, index) => {
    if (value !== 0n) {
      throw new Error(
        `${label} ${index + 1} must be empty before first mint`
      );
    }
  });
}
export async function assertRecipientContractsReady(
  provider: NetworkProvider,
  infrastructure: InfrastructureContracts,
  graph: TokenGraphContracts,
  distribution: DomDistributionAddresses,
  controls: DomRecipientControls,
  compiled: CompiledContracts
): Promise<void> {
  await assertRecipientTopologyAndCode(
    provider,
    infrastructure,
    graph,
    distribution,
    controls,
    compiled
  );
  const frs = provider.open(
    FrsAllodium.createFromAddress(distribution.frsAllodium)
  );
  const allodiumFoundation = provider.open(
    AllodiumFoundation.createFromAddress(
      distribution.allodiumFoundation
    )
  );
  const market = provider.open(
    MarketMaker.createFromAddress(distribution.defiMarket)
  );
  const foundry = provider.open(
    FoundryLock.createFromAddress(distribution.defiFoundry)
  );
  const defiBank = provider.open(
    BankDefi.createFromAddress(distribution.defiTreasury)
  );
  const daoBank = provider.open(
    BankDao.createFromAddress(distribution.daoBank)
  );
  const daoFoundation = provider.open(
    DaoFoundation.createFromAddress(distribution.daoFoundation)
  );
  const dominumBank = provider.open(
    BankDominum.createFromAddress(distribution.dominumBank)
  );
  const dominumFoundation = provider.open(
    DominumFoundation.createFromAddress(
      distribution.dominumFoundation
    )
  );
  const data = await Promise.all([
    frs.getFrsData(),
    allodiumFoundation.getFoundationData(),
    market.getMarketData(),
    foundry.getFoundryLockData(),
    defiBank.getDefiBankData(),
    daoBank.getBankData(),
    daoFoundation.getFoundationData(),
    dominumBank.getBankDominumData(),
    dominumFoundation.getFoundationData(),
    infrastructure.treasuryPool.getTreasuryPoolData(),
  ]);
  const recipientAddresses = [
    distribution.frsAllodium,
    distribution.allodiumFoundation,
    distribution.defiMarket,
    distribution.defiFoundry,
    distribution.defiTreasury,
    distribution.daoBank,
    distribution.daoFoundation,
    distribution.dominumBank,
    distribution.dominumFoundation,
  ];
  const wallets = await Promise.all(
    recipientAddresses.map(
      (address) => graph.domMaster.getWalletAddress(address)
    )
  );
  const [
    frsData, allodiumData, marketData, foundryData, defiBankData,
    daoBankData, daoFoundationData, dominumBankData,
    dominumFoundationData, treasuryData,
  ] = data;
  checkAddresses([
    [frsData.ownerAddress, controls.frsOwner, 'FRS owner'],
    [frsData.domWalletAddress, wallets[0], 'FRS DOM wallet'],
    [frsData.allodMasterAddress, controls.allodMaster, 'FRS AllodMaster'],
    [
      frsData.giverAllodiumAddress,
      graph.giverAllodium.address,
      'FRS GiverAllodium',
    ],
    [
      frsData.allodiumFoundationAddress,
      distribution.allodiumFoundation,
      'FRS Allodium Foundation',
    ],
    [
      allodiumData.ownerAddress,
      controls.allodiumFoundationOwner,
      'Allodium Foundation owner',
    ],
    [
      allodiumData.domWalletAddress,
      wallets[1],
      'Allodium Foundation DOM wallet',
    ],
    [marketData.ownerAddress, controls.marketOwner, 'Market owner'],
    [marketData.walletAddress, wallets[2], 'Market DOM wallet'],
    [
      marketData.defiBankAddress,
      distribution.defiTreasury,
      'Market DeFi Bank',
    ],
    [
      marketData.defiFoundationAddress,
      controls.defiFoundation,
      'Market DeFi Foundation',
    ],
    [foundryData.ownerAddress, controls.foundryOwner, 'Foundry owner'],
    [foundryData.walletAddress, wallets[3], 'Foundry DOM wallet'],
    [
      foundryData.releaseAddress,
      controls.foundryRelease,
      'Foundry release',
    ],
    [
      defiBankData.ownerAddress,
      controls.defiBankOwner,
      'DeFi Bank owner',
    ],
    [defiBankData.walletAddress, wallets[4], 'DeFi Bank DOM wallet'],
    [
      defiBankData.defiFoundationAddress,
      controls.defiFoundation,
      'DeFi Bank Foundation',
    ],
    [
      defiBankData.marketMakerAddress,
      distribution.defiMarket,
      'DeFi Bank Market',
    ],
    [daoBankData.ownerAddress, controls.daoBankOwner, 'DAO Bank owner'],
    [daoBankData.walletAddress, wallets[5], 'DAO Bank DOM wallet'],
    [
      daoFoundationData.ownerAddress,
      controls.daoFoundationOwner,
      'DAO Foundation owner',
    ],
    [
      daoFoundationData.walletAddress,
      wallets[6],
      'DAO Foundation DOM wallet',
    ],
    [
      dominumBankData.ownerAddress,
      controls.dominumBankOwner,
      'Dominum Bank owner',
    ],
    [
      dominumBankData.gasPoolAddress,
      infrastructure.gasPool.address,
      'Dominum Bank GasPool',
    ],
    [
      dominumBankData.domWalletAddress,
      wallets[7],
      'Dominum Bank DOM wallet',
    ],
    [
      dominumFoundationData.ownerAddress,
      controls.dominumFoundationOwner,
      'Dominum Foundation owner',
    ],
    [
      dominumFoundationData.walletAddress,
      wallets[8],
      'Dominum Foundation DOM wallet',
    ],
    [
      treasuryData.bankDaoAddress,
      distribution.daoBank,
      'TreasuryPool DAO Bank',
    ],
    [
      treasuryData.bankDefiAddress,
      distribution.defiTreasury,
      'TreasuryPool DeFi Bank',
    ],
    [
      treasuryData.bankDominumAddress,
      distribution.dominumBank,
      'TreasuryPool Dominum Bank',
    ],
  ]);
  if (!frsData.giverConfigured || !frsData.walletConfigured) {
    throw new Error('FRS one-shot configuration is incomplete');
  }
  if (!marketData.bankConfigured || !marketData.walletConfigured) {
    throw new Error('Market one-shot configuration is incomplete');
  }
  if (!daoBankData.walletConfigured) {
    throw new Error('DAO Bank wallet is not configured');
  }
  checkEmpty(
    [
      allodiumData.whitelistCount,
      defiBankData.whitelistCount,
      daoBankData.whitelistCount,
      daoFoundationData.whitelistCount,
      dominumBankData.whitelistCount,
      dominumFoundationData.whitelistCount,
    ],
    'Recipient whitelist'
  );
  checkEmpty(
    [
      frsData.lockedDom,
      allodiumData.totalReceived,
      allodiumData.totalSent,
      marketData.totalReceived,
      marketData.totalSent,
      foundryData.totalReceived,
      foundryData.totalLocked,
      foundryData.totalUnlocked,
      foundryData.totalFeePaid,
      foundryData.totalReturnedFee,
      defiBankData.totalReceived,
      defiBankData.totalSent,
      daoBankData.totalReceived,
      daoBankData.totalSent,
      daoFoundationData.totalReceived,
      daoFoundationData.totalSent,
      dominumFoundationData.totalReceived,
      dominumFoundationData.totalSent,
    ],
    'Recipient counter'
  );
  const allowed = await Promise.all([
    market.isAddressAllowed(distribution.defiTreasury),
    market.isAddressAllowed(controls.defiFoundation),
    defiBank.isAddressAllowed(distribution.defiMarket),
    defiBank.isAddressAllowed(controls.defiFoundation),
  ]);
  if (allowed.some((value) => !value)) {
    throw new Error('DeFi fixed routing is incomplete');
  }
}
