import { beginCell } from '@ton/core';
import { compile } from '@ton/blueprint';
import { Blockchain } from '@ton/sandbox';
import { DomMaster } from '../../../wrappers/Dominum/dom/DomMaster';
import { Minter } from '../../../wrappers/Dominum/treasury/Minter';
import { GasPool } from '../../../wrappers/Dominum/pools/GasPool';
import { TreasuryPool } from '../../../wrappers/Dominum/treasury/TreasuryPool';
import { GiverDao } from '../../../wrappers/Dominum/givers/GiverDao';
import { GiverDefi } from '../../../wrappers/Dominum/givers/GiverDefi';
import { GiverAllodium } from '../../../wrappers/Dominum/givers/GiverAllodium';
import { GiverDominum } from '../../../wrappers/Dominum/givers/GiverDominum';
import {
  GiverManager,
} from '../../../wrappers/Dominum/management/GiverManager';
import {
  MinterManager,
} from '../../../wrappers/Dominum/management/MinterManager';
import {
  TreasuryManager,
} from '../../../wrappers/Dominum/management/TreasuryManager';
import {
  GIVER_TARGET,
  TREASURY_TARGET,
} from '../../../wrappers/Dominum/core/constants';
import {
  buildTypedPlaceholderAddress,
} from '../../../scripts/Dominum/core/helpers';
import {
  DOM_COMPILE,
  DOM_FULL_MINT_ACCOUNT_NAMES,
  DOM_FULL_MINT_CODE_NAMES,
  DOM_QUERY,
  DOM_STATE,
  DOM_VALUE,
} from './dom-test-values';
export async function createFullMintFlowFixture() {
  const blockchain = await Blockchain.create();
  const accountList = await Promise.all(
    DOM_FULL_MINT_ACCOUNT_NAMES.map((name) => blockchain.treasury(name))
  );
  const account = Object.fromEntries(
    DOM_FULL_MINT_ACCOUNT_NAMES.map(
      (name, index) => [name, accountList[index]]
    )
  ) as Record<
    typeof DOM_FULL_MINT_ACCOUNT_NAMES[number],
    (typeof accountList)[number]
  >;
  const recipients = {
    frsAllodium: account.frsAllodium,
    allodiumFoundation: account.allodiumFoundation,
    defiMarket: account.defiMarket,
    defiFoundry: account.defiFoundry,
    defiTreasury: account.defiTreasury,
    daoBank: account.daoBank,
    daoFoundation: account.daoFoundation,
    dominumBank: account.dominumBank,
    dominumFoundation: account.dominumFoundation,
  };
  const codeList = await Promise.all(
    DOM_FULL_MINT_CODE_NAMES.map((name) => compile(DOM_COMPILE[name]))
  );
  const code = Object.fromEntries(
    DOM_FULL_MINT_CODE_NAMES.map(
      (name, index) => [name, codeList[index]]
    )
  ) as Record<
    typeof DOM_FULL_MINT_CODE_NAMES[number],
    (typeof codeList)[number]
  >;
  const placeholder = {
    gas: buildTypedPlaceholderAddress(1, TREASURY_TARGET.gasPool),
    wallet: buildTypedPlaceholderAddress(1, 5),
    minter: buildTypedPlaceholderAddress(20, 1),
    allodium: buildTypedPlaceholderAddress(21, GIVER_TARGET.allodium),
    defi: buildTypedPlaceholderAddress(21, GIVER_TARGET.defi),
    dao: buildTypedPlaceholderAddress(21, GIVER_TARGET.dao),
    dominum: buildTypedPlaceholderAddress(21, GIVER_TARGET.dominum),
  };
  const treasuryManager = blockchain.openContract(
    TreasuryManager.createFromConfig(
      { ownerAddress: account.treasuryManagerOwner.address },
      code.treasuryManager
    )
  );
  const treasuryPool = blockchain.openContract(
    TreasuryPool.createFromConfig(
      {
        ownerAddress: account.treasuryOwner.address,
        treasuryManagerAddress: treasuryManager.address,
        jettonWalletAddress: placeholder.wallet,
        walletConfigured: false,
        bankDaoAddress: account.daoBank.address,
        bankDefiAddress: account.defiTreasury.address,
        bankDominumAddress: account.dominumBank.address,
        gasPoolAddress: placeholder.gas,
      },
      code.treasuryPool
    )
  );
  const gasPool = blockchain.openContract(
    GasPool.createFromConfig(
      {
        treasuryPoolAddress: treasuryPool.address,
        masterAddress: buildTypedPlaceholderAddress(2, 1),
        jettonWalletCode: code.wallet,
        masterConfigured: false,
      },
      code.gasPool
    )
  );
  const minterManager = blockchain.openContract(
    MinterManager.createFromConfig(
      { ownerAddress: account.minterManagerOwner.address },
      code.minterManager
    )
  );
  const giverManager = blockchain.openContract(
    GiverManager.createFromConfig(
      { ownerAddress: account.giverManagerOwner.address },
      code.giverManager
    )
  );
  const domMaster = blockchain.openContract(
    DomMaster.createFromConfig(
      {
        totalSupply: DOM_STATE.emptySupply,
        ownerAddress: account.masterOwner.address,
        lastMintTime: DOM_STATE.noLastMintTime,
        isStarted: false,
        treasuryPoolAddress: treasuryPool.address,
        minterAddress: placeholder.minter,
        minterManagerAddress: minterManager.address,
        giverManagerAddress: giverManager.address,
        giverAllodiumAddress: placeholder.allodium,
        giverDefiAddress: placeholder.defi,
        giverDaoAddress: placeholder.dao,
        giverDominumAddress: placeholder.dominum,
        content: beginCell().endCell(),
        jettonWalletCode: code.wallet,
      },
      code.master
    )
  );
  const minter = blockchain.openContract(
    Minter.createFromConfig(
      {
        ownerAddress: account.minterOwner.address,
        masterAddress: domMaster.address,
      },
      code.minter
    )
  );
  const giverCore = {
    masterAddress: domMaster.address,
    treasuryPoolAddress: treasuryPool.address,
    jettonWalletCode: code.wallet,
  };
  const giverAllodium = blockchain.openContract(
    GiverAllodium.createFromConfig(
      {
        ...giverCore,
        frsAllodiumAddress: account.frsAllodium.address,
        allodiumFoundationAddress: account.allodiumFoundation.address,
      },
      code.giverAllodium
    )
  );
  const giverDefi = blockchain.openContract(
    GiverDefi.createFromConfig(
      {
        ...giverCore,
        marketAddress: account.defiMarket.address,
        foundryAddress: account.defiFoundry.address,
        defiTreasuryAddress: account.defiTreasury.address,
      },
      code.giverDefi
    )
  );
  const giverDao = blockchain.openContract(
    GiverDao.createFromConfig(
      {
        ...giverCore,
        bankDaoAddress: account.daoBank.address,
        daoFoundationAddress: account.daoFoundation.address,
      },
      code.giverDao
    )
  );
  const giverDominum = blockchain.openContract(
    GiverDominum.createFromConfig(
      {
        ...giverCore,
        bankDominumAddress: account.dominumBank.address,
        dominumFoundationAddress: account.dominumFoundation.address,
      },
      code.giverDominum
    )
  );
  const givers = [giverAllodium, giverDefi, giverDao, giverDominum];
  const uniqueGivers = new Set(
    givers.map((giver) => giver.address.toRawString())
  );
  if (uniqueGivers.size !== givers.length) {
    throw new Error('Full mint fixture contains a Giver address collision');
  }
  const deployer = account.deployer.getSender();
  await treasuryManager.sendDeploy(deployer, DOM_VALUE.deploySmall);
  await treasuryPool.sendDeploy(deployer, DOM_VALUE.deployTreasuryPool);
  await gasPool.sendDeploy(deployer, DOM_VALUE.deployGasPool);
  await minterManager.sendDeploy(deployer, DOM_VALUE.deploySmall);
  await giverManager.sendDeploy(deployer, DOM_VALUE.deploySmall);
  await domMaster.sendDeploy(deployer, DOM_VALUE.deploySmall);
  await minter.sendDeploy(deployer, DOM_VALUE.deploySmall);
  for (const giver of givers) {
    await giver.sendDeploy(deployer, DOM_VALUE.deployTreasuryPool);
  }
  await treasuryManager.sendReplaceTreasuryAddress(
    account.treasuryManagerOwner.getSender(),
    {
      value: DOM_VALUE.config,
      treasuryPoolAddress: treasuryPool.address,
      targetKind: TREASURY_TARGET.gasPool,
      oldAddress: placeholder.gas,
      newAddress: gasPool.address,
      queryId: DOM_QUERY.treasuryAddressRequest,
    }
  );
  await treasuryPool.sendConfirmRequest(
    account.treasuryOwner.getSender(),
    {
      value: DOM_VALUE.config,
      queryId: DOM_QUERY.treasuryAddressConfirm,
    }
  );
  await treasuryPool.sendInitMasterConfig(
    account.treasuryOwner.getSender(),
    {
      value: DOM_VALUE.gasPipeline,
      masterAddress: domMaster.address,
      jettonWalletCode: code.wallet,
      queryId: DOM_QUERY.gasInitMaster,
    }
  );
  const treasuryWallet =
    await domMaster.getWalletAddress(treasuryPool.address);
  await treasuryPool.sendInitTreasuryWalletConfig(
    account.treasuryOwner.getSender(),
    {
      value: DOM_VALUE.config, jettonWalletAddress: treasuryWallet,
      queryId: DOM_QUERY.treasuryWalletInit,
    }
  );
  await minterManager.sendReplaceMinter(
    account.minterManagerOwner.getSender(),
    {
      value: DOM_VALUE.config, masterAddress: domMaster.address,
      oldMinterAddress: placeholder.minter,
      newMinterAddress: minter.address,
      queryId: DOM_QUERY.replaceMinter,
    }
  );
  await domMaster.sendConfirmMasterRequest(
    account.masterOwner.getSender(),
    {
      value: DOM_VALUE.config, queryId: DOM_QUERY.replaceMinter + 1n,
    }
  );
  const replacements = [
    [GIVER_TARGET.allodium, placeholder.allodium,
      giverAllodium.address, DOM_QUERY.replaceGiverAllodium],
    [GIVER_TARGET.defi, placeholder.defi,
      giverDefi.address, DOM_QUERY.replaceGiverDefi],
    [GIVER_TARGET.dao, placeholder.dao,
      giverDao.address, DOM_QUERY.replaceGiverDao],
    [GIVER_TARGET.dominum, placeholder.dominum,
      giverDominum.address, DOM_QUERY.replaceGiverDominum],
  ] as const;
  for (const [targetKind, oldAddress, newAddress, queryId] of replacements) {
    await giverManager.sendReplaceGiver(
      account.giverManagerOwner.getSender(),
      {
        value: DOM_VALUE.config, masterAddress: domMaster.address,
        targetKind, oldGiverAddress: oldAddress,
        newGiverAddress: newAddress, queryId,
      }
    );
    await domMaster.sendConfirmMasterRequest(
      account.masterOwner.getSender(),
      {
        value: DOM_VALUE.config, queryId: queryId + 100n,
      }
    );
  }
  return {
    blockchain, account, code, minterOwner: account.minterOwner, recipients,
    domMaster, minter, treasuryPool, gasPool, treasuryManager, giverManager,
    giverAllodium, giverDefi, giverDao, giverDominum,
  };
}
