/// <reference types="jest" />
import { Address } from '@ton/core';
import { compile } from '@ton/blueprint';
import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';
import { FrsAllodium } from '../../../wrappers/Allodium/treasury/FrsAllodium';
import { AllodiumFoundation }
  from '../../../wrappers/Allodium/foundation/AllodiumFoundation';
import { MarketMaker } from '../../../wrappers/Dominum/defi/MarketMaker';
import { FoundryLock } from '../../../wrappers/Dominum/invest/FoundryLock';
import { BankDefi } from '../../../wrappers/Dominum/banks/BankDefi';
import { BankDao } from '../../../wrappers/Dominum/banks/BankDao';
import { DaoFoundation }
  from '../../../wrappers/Dominum/foundation/DaoFoundation';
import { BankDominum } from '../../../wrappers/Dominum/banks/BankDominum';
import { DominumFoundation }
  from '../../../wrappers/Dominum/foundation/DominumFoundation';
import { GiverAllodium } from '../../../wrappers/Dominum/givers/GiverAllodium';
import { GiverDefi } from '../../../wrappers/Dominum/givers/GiverDefi';
import { GiverDao } from '../../../wrappers/Dominum/givers/GiverDao';
import { GiverDominum } from '../../../wrappers/Dominum/givers/GiverDominum';
import { GIVER_TARGET, TREASURY_TARGET }
  from '../../../wrappers/Dominum/core/constants';
import { createFullMintFlowFixture }
  from '../_helpers/full-mint-flow.fixture';
import { DOM_FIXTURE, DOM_QUERY, DOM_VALUE }
  from '../_helpers/dom-test-values';
import { calculateFirstMintRecipientAmounts }
  from '../_helpers/dom-test-values';
const GRAPH_COMPILES = [
  'Allodium/treasury/FrsAllodium', 'Allodium/foundation/AllodiumFoundation',
  'Dominum/defi/MarketMaker', 'Dominum/invest/FoundryLock',
  'Dominum/banks/BankDefi', 'Dominum/banks/BankDao',
  'Dominum/dao/DaoFoundation', 'Dominum/banks/BankDominum',
  'Dominum/foundation/DominumFoundation',
] as const;
const AUXILIARY_NAMES = [
  'frsWallet', 'allodiumWallet', 'marketWallet', 'foundryWallet',
  'defiBankWallet', 'daoBankWallet', 'daoFoundationWallet',
  'dominumBankWallet', 'dominumFoundationWallet', 'frsGiver',
  'marketBank', 'allodMaster', 'defiFoundation', 'foundryRelease',
] as const;
type AuxiliaryKey = (typeof AUXILIARY_NAMES)[number];
describe('DOM full contract graph', () => {
  it('mints through real givers into nine configured contracts', async () => {
    const fixture = await createFullMintFlowFixture();
    const { account: a, blockchain: b } = fixture;
    const deployValue = DOM_VALUE.deployTreasuryPool;
    const auxiliaryList = await Promise.all(
      AUXILIARY_NAMES.map((name) => b.treasury(`graph-${name}`))
    );
    const x = Object.fromEntries(
      AUXILIARY_NAMES.map((name, index) => [name, auxiliaryList[index]])
    ) as Record<AuxiliaryKey, (typeof auxiliaryList)[number]>;
    const [
      frsCode, allodiumCode, marketCode, foundryCode, bankDefiCode,
      bankDaoCode, daoCode, bankDominumCode, dominumCode,
    ] = await Promise.all(GRAPH_COMPILES.map((name) => compile(name)));
    const base = (ownerAddress: Address, walletAddress: Address) => ({
      ownerAddress, walletAddress, walletConfigured: false,
    });
    const allodiumFoundation = b.openContract(
      AllodiumFoundation.createFromConfig({
        ownerAddress: a.allodiumFoundation.address,
        domWalletAddress: x.allodiumWallet.address,
        walletConfigured: false,
      }, allodiumCode));
    const frsAllodium = b.openContract(
      FrsAllodium.createFromConfig({
        ownerAddress: a.frsAllodium.address,
        domWalletAddress: x.frsWallet.address,
        allodMasterAddress: x.allodMaster.address,
        giverAllodiumAddress: x.frsGiver.address,
        allodiumFoundationAddress: allodiumFoundation.address,
        giverConfigured: false, walletConfigured: false,
      }, frsCode));
    const market = b.openContract(
      MarketMaker.createFromConfig({
        ...base(a.defiMarket.address, x.marketWallet.address),
        defiBankAddress: x.marketBank.address,
        defiFoundationAddress: x.defiFoundation.address,
        bankConfigured: false,
      }, marketCode));
    const foundry = b.openContract(
      FoundryLock.createFromConfig({
        ...base(a.defiFoundry.address, x.foundryWallet.address),
        releaseAddress: x.foundryRelease.address,
      }, foundryCode));
    const bankDefi = b.openContract(
      BankDefi.createFromConfig({
        ...base(a.defiTreasury.address, x.defiBankWallet.address),
        defiFoundationAddress: x.defiFoundation.address,
        marketMakerAddress: market.address,
      }, bankDefiCode));
    const bankDao = b.openContract(BankDao.createFromConfig(
      base(a.daoBank.address, x.daoBankWallet.address), bankDaoCode));
    const daoFoundation = b.openContract(DaoFoundation.createFromConfig(
      base(a.daoFoundation.address, x.daoFoundationWallet.address), daoCode));
    const bankDominum = b.openContract(
      BankDominum.createFromConfig({
        ownerAddress: a.dominumBank.address,
        gasPoolAddress: fixture.gasPool.address,
        domWalletAddress: x.dominumBankWallet.address,
        walletConfigured: false,
      }, bankDominumCode));
    const dominumFoundation = b.openContract(
      DominumFoundation.createFromConfig(base(
        a.dominumFoundation.address, x.dominumFoundationWallet.address
      ), dominumCode));
    const recipients = {
      frsAllodium, allodiumFoundation, defiMarket: market,
      defiFoundry: foundry, defiTreasury: bankDefi, daoBank: bankDao,
      daoFoundation, dominumBank: bankDominum, dominumFoundation,
    } as const;
    for (const endpoint of Object.values(recipients)) {
      await endpoint.sendDeploy(a.deployer.getSender(), deployValue);
    }
    const giverCore = {
      masterAddress: fixture.domMaster.address,
      treasuryPoolAddress: fixture.treasuryPool.address,
      jettonWalletCode: fixture.code.wallet,
    };
    const giverAllodium = b.openContract(
      GiverAllodium.createFromConfig({
        ...giverCore, frsAllodiumAddress: frsAllodium.address,
        allodiumFoundationAddress: allodiumFoundation.address,
      }, fixture.code.giverAllodium));
    const giverDefi = b.openContract(
      GiverDefi.createFromConfig({
        ...giverCore, marketAddress: market.address,
        foundryAddress: foundry.address,
        defiTreasuryAddress: bankDefi.address,
      }, fixture.code.giverDefi));
    const giverDao = b.openContract(
      GiverDao.createFromConfig({
        ...giverCore, bankDaoAddress: bankDao.address,
        daoFoundationAddress: daoFoundation.address,
      }, fixture.code.giverDao));
    const giverDominum = b.openContract(
      GiverDominum.createFromConfig({
        ...giverCore, bankDominumAddress: bankDominum.address,
        dominumFoundationAddress: dominumFoundation.address,
      }, fixture.code.giverDominum));
    for (const giver of [
      giverAllodium, giverDefi, giverDao, giverDominum,
    ]) {
      await giver.sendDeploy(a.deployer.getSender(), deployValue);
    }
    const walletPairs = await Promise.all(
      Object.entries(recipients).map(async ([name, recipient]) => [
        name,
        await fixture.domMaster.getWalletAddress(recipient.address),
      ] as const));
    type RecipientKey = keyof typeof recipients;
    const wallets = Object.fromEntries(walletPairs) as Record<
      RecipientKey, Address>;
    const init = (walletAddress: Address) => ({
      value: DOM_VALUE.config, walletAddress,
    });
    const o = {
      frs: a.frsAllodium.getSender(),
      allodium: a.allodiumFoundation.getSender(),
      market: a.defiMarket.getSender(), foundry: a.defiFoundry.getSender(),
      defiBank: a.defiTreasury.getSender(), daoBank: a.daoBank.getSender(),
      dao: a.daoFoundation.getSender(), domBank: a.dominumBank.getSender(),
      dominum: a.dominumFoundation.getSender(),
    };
    const walletInitializers = [
      () => frsAllodium.sendInitWallet(o.frs, init(wallets.frsAllodium)),
      () => allodiumFoundation.sendInitWallet(
        o.allodium, init(wallets.allodiumFoundation)),
      () => market.sendInitWallet(o.market, init(wallets.defiMarket)),
      () => foundry.sendInitWallet(o.foundry, init(wallets.defiFoundry)),
      () => bankDefi.sendInitWallet(o.defiBank, init(wallets.defiTreasury)),
      () => bankDao.sendInitWalletConfig(o.daoBank, init(wallets.daoBank)),
      () => daoFoundation.sendInitWallet(
        o.dao, init(wallets.daoFoundation)),
      () => bankDominum.sendInitWallet(
        o.domBank, init(wallets.dominumBank)),
      () => dominumFoundation.sendInitWallet(
        o.dominum, init(wallets.dominumFoundation)),
    ];
    for (const initialize of walletInitializers) {
      await initialize();
    }
    await frsAllodium.sendInitGiver(o.frs, {
      value: DOM_VALUE.config, giverAddress: giverAllodium.address,
      queryId: 1010n,
    });
    await market.sendInitDefiBank(o.market, {
      value: DOM_VALUE.config, bankAddress: bankDefi.address,
      queryId: 1011n,
    });

    const giverRotations = [
      [GIVER_TARGET.allodium, fixture.giverAllodium, giverAllodium],
      [GIVER_TARGET.defi, fixture.giverDefi, giverDefi],
      [GIVER_TARGET.dao, fixture.giverDao, giverDao],
      [GIVER_TARGET.dominum, fixture.giverDominum, giverDominum],
    ] as const;
    for (const [index, rotation] of giverRotations.entries()) {
      const [targetKind, oldGiver, newGiver] = rotation;
      const queryId = 1100n + BigInt(index);
      await fixture.giverManager.sendReplaceGiver(
        a.giverManagerOwner.getSender(), {
          value: DOM_VALUE.config, targetKind, queryId,
          masterAddress: fixture.domMaster.address,
          oldGiverAddress: oldGiver.address,
          newGiverAddress: newGiver.address,
        });
      await fixture.domMaster.sendConfirmMasterRequest(
        a.masterOwner.getSender(), {
          value: DOM_VALUE.config, queryId: queryId + 100n,
        });
    }
    const treasuryRotations = [
      [TREASURY_TARGET.bankDao, a.daoBank.address, bankDao.address],
      [TREASURY_TARGET.bankDefi, a.defiTreasury.address, bankDefi.address],
      [
        TREASURY_TARGET.bankDominum,
        a.dominumBank.address,
        bankDominum.address,
      ],
    ] as const;
    for (const [index, rotation] of treasuryRotations.entries()) {
      const [targetKind, oldAddress, newAddress] = rotation;
      const queryId = 1200n + BigInt(index);
      await fixture.treasuryManager.sendReplaceTreasuryAddress(
        a.treasuryManagerOwner.getSender(), {
          value: DOM_VALUE.config, targetKind, queryId,
          treasuryPoolAddress: fixture.treasuryPool.address,
          oldAddress, newAddress,
        });
      await fixture.treasuryPool.sendConfirmRequest(
        a.treasuryOwner.getSender(), {
          value: DOM_VALUE.config, queryId: queryId + 100n,
        });
    }
    await fixture.minter.sendMint(fixture.minterOwner.getSender(), {
      value: DOM_VALUE.mint,
      amount: DOM_FIXTURE.firstMintAmount,
      queryId: DOM_QUERY.e2eMint + 1n,
    });
    const balancePairs = await Promise.all(
      Object.entries(wallets).map(async ([name, walletAddress]) => {
        const wallet = b.openContract(
          DomWallet.createFromAddress(walletAddress)
        );
        return [name, (await wallet.getWalletData()).balance] as const;
      })
    );
    const expected = calculateFirstMintRecipientAmounts();
    expect(Object.fromEntries(balancePairs)).toEqual(expected);

    const [frsData, allodiumData, marketData, foundryData, bankDefiData,
      bankDaoData, daoData, bankDominumData, dominumData] =
      await Promise.all([
        frsAllodium.getFrsData(), allodiumFoundation.getFoundationData(),
        market.getMarketData(), foundry.getFoundryLockData(),
        bankDefi.getDefiBankData(), bankDao.getDaoBankData(),
        daoFoundation.getFoundationData(),
        bankDominum.getBankDominumData(),
        dominumFoundation.getFoundationData(),
      ]);
    expect([
      frsData.walletConfigured, allodiumData.walletConfigured,
      marketData.walletConfigured, foundryData.walletConfigured,
      bankDefiData.walletConfigured, bankDaoData.walletConfigured,
      daoData.walletConfigured, bankDominumData.walletConfigured,
      dominumData.walletConfigured,
    ]).toEqual(Array(9).fill(true));
    expect(frsData.giverConfigured).toBe(true);
    expect(marketData.bankConfigured).toBe(true);
    expect([
      frsData.lockedDom, allodiumData.totalReceived,
      marketData.totalReceived, foundryData.totalReceived,
      foundryData.totalLocked, bankDefiData.totalReceived,
      bankDaoData.totalReceived, daoData.totalReceived,
      dominumData.totalReceived,
    ]).toEqual([
      expected.frsAllodium, expected.allodiumFoundation,
      expected.defiMarket, expected.defiFoundry, expected.defiFoundry,
      expected.defiTreasury, expected.daoBank, expected.daoFoundation,
      expected.dominumFoundation,
    ]);

    const [masterGivers, treasuryData] = await Promise.all([
      fixture.domMaster.getGiversData(),
      fixture.treasuryPool.getTreasuryPoolData(),
    ]);
    expect([
      masterGivers.giverAllodiumAddress.equals(giverAllodium.address),
      masterGivers.giverDefiAddress.equals(giverDefi.address),
      masterGivers.giverDaoAddress.equals(giverDao.address),
      masterGivers.giverDominumAddress.equals(giverDominum.address),
      treasuryData.bankDaoAddress.equals(bankDao.address),
      treasuryData.bankDefiAddress.equals(bankDefi.address),
      treasuryData.bankDominumAddress.equals(bankDominum.address),
    ]).toEqual(Array(7).fill(true));
  });
});
