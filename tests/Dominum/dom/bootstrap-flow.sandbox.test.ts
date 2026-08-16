/// <reference types="jest" />

import { compile } from '@ton/blueprint';
import { Blockchain } from '@ton/sandbox';
import { toNano } from '@ton/core';
import {
  DomRecipientDependencies,
  DomRecipientOwnerAddresses,
} from '../../../scripts/Dominum/core/config';
import {
  planDominumBank,
  planPreGraphRecipients,
  preGraphAddresses,
} from '../../../scripts/Dominum/foundation/deployRecipients';
import {
  assertMetadataDocument,
} from '../../../scripts/Dominum/foundation/metadataPreflight';
import {
  assertTestnetEndpoint,
} from '../../../scripts/runtime/toncenter-v3/DomProvider';

const RECIPIENT_COMPILES = {
  frsAllodiumCode: 'Allodium/treasury/FrsAllodium',
  allodiumFoundationCode: 'Allodium/foundation/AllodiumFoundation',
  marketMakerCode: 'Dominum/defi/MarketMaker',
  foundryLockCode: 'Dominum/invest/FoundryLock',
  bankDefiCode: 'Dominum/banks/BankDefi',
  bankDaoCode: 'Dominum/banks/BankDao',
  daoFoundationCode: 'Dominum/dao/DaoFoundation',
  bankDominumCode: 'Dominum/banks/BankDominum',
  dominumFoundationCode: 'Dominum/foundation/DominumFoundation',
} as const;

async function compileRecipients() {
  const pairs = await Promise.all(
    Object.entries(RECIPIENT_COMPILES).map(async ([key, name]) => {
      return [key, await compile(name)] as const;
    })
  );

  return Object.fromEntries(pairs) as {
    [K in keyof typeof RECIPIENT_COMPILES]:
      Awaited<ReturnType<typeof compile>>;
  };
}

describe('DOM recipient bootstrap flow', () => {
  it('deploys unique staged recipients with immutable links', async () => {
    const blockchain = await Blockchain.create();
    const deployer = await blockchain.treasury('bootstrap-deployer');
    const codes = await compileRecipients();
    const ownerNames = [
      'frs', 'allodium', 'market', 'foundry', 'defi-bank',
      'dao-bank', 'dao-foundation', 'dominum-bank',
      'dominum-foundation',
    ];
    const ownerAccounts = await Promise.all(
      ownerNames.map((name) => blockchain.treasury(`owner-${name}`))
    );
    const owners: DomRecipientOwnerAddresses = {
      frsOwner: ownerAccounts[0].address,
      allodiumFoundationOwner: ownerAccounts[1].address,
      marketOwner: ownerAccounts[2].address,
      foundryOwner: ownerAccounts[3].address,
      defiBankOwner: ownerAccounts[4].address,
      daoBankOwner: ownerAccounts[5].address,
      daoFoundationOwner: ownerAccounts[6].address,
      dominumBankOwner: ownerAccounts[7].address,
      dominumFoundationOwner: ownerAccounts[8].address,
    };
    const allodMaster = await blockchain.treasury('allod-master');
    const defiFoundation = await blockchain.treasury('defi-foundation');
    const foundryRelease = await blockchain.treasury('foundry-release');
    const dependencies: DomRecipientDependencies = {
      allodMaster: allodMaster.address,
      defiFoundation: defiFoundation.address,
      foundryRelease: foundryRelease.address,
    };
    const plan = planPreGraphRecipients(codes, owners, dependencies);
    const addresses = Object.values(preGraphAddresses(plan));

    expect(new Set(addresses.map((address) => address.toRawString())).size)
      .toBe(addresses.length);

    const opened = {
      frs: blockchain.openContract(plan.frsAllodium),
      allodium: blockchain.openContract(plan.allodiumFoundation),
      market: blockchain.openContract(plan.defiMarket),
      foundry: blockchain.openContract(plan.defiFoundry),
      defiBank: blockchain.openContract(plan.defiTreasury),
      daoBank: blockchain.openContract(plan.daoBank),
      daoFoundation: blockchain.openContract(plan.daoFoundation),
      dominumFoundation:
        blockchain.openContract(plan.dominumFoundation),
    };

    for (const contract of Object.values(opened)) {
      await contract.sendDeploy(
        deployer.getSender(),
        toNano('0.05')
      );
    }

    const gasPool = await blockchain.treasury('real-gas-pool');
    const dominumBankPlan = planDominumBank(
      codes.bankDominumCode,
      owners.dominumBankOwner,
      gasPool.address
    );
    const dominumBank = blockchain.openContract(dominumBankPlan);
    await dominumBank.sendDeploy(deployer.getSender(), toNano('0.05'));

    const [frs, market, defiBank, dominumBankData] = await Promise.all([
      opened.frs.getFrsData(),
      opened.market.getMarketData(),
      opened.defiBank.getDefiBankData(),
      dominumBank.getBankDominumData(),
    ]);

    expect(frs.allodMasterAddress.equals(dependencies.allodMaster))
      .toBe(true);
    expect(frs.allodiumFoundationAddress.equals(opened.allodium.address))
      .toBe(true);
    expect([frs.giverConfigured, frs.walletConfigured])
      .toEqual([false, false]);
    expect(market.defiFoundationAddress.equals(
      dependencies.defiFoundation
    )).toBe(true);
    expect([market.bankConfigured, market.walletConfigured])
      .toEqual([false, false]);
    expect(defiBank.marketMakerAddress.equals(opened.market.address))
      .toBe(true);
    expect(dominumBankData.gasPoolAddress.equals(gasPool.address))
      .toBe(true);
    expect(dominumBankData.walletConfigured).toBe(false);
  });

  it('accepts DV1 test metadata and only a testnet endpoint', () => {
    expect(assertMetadataDocument({
      name: 'Dominum V1 Test',
      symbol: 'tDOMV1',
      decimals: '6',
      image: 'https://example.test/dom.png',
    })).toBeDefined();
    expect(() => assertTestnetEndpoint(
      'https://testnet.toncenter.com/api/v3'
    )).not.toThrow();
    expect(() => assertTestnetEndpoint(
      'https://toncenter.com/api/v3'
    )).toThrow('Mainnet Toncenter endpoint is forbidden');
  });
});
