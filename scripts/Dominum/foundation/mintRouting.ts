import { Address, Cell } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';

import {
  DomDistributionAddresses,
  DomRecipientControls,
} from '../core/config';

import {
  CompiledContracts,
  InfrastructureContracts,
  TokenGraphContracts,
} from '../core/types';

type GiverCoreData = {
  masterAddress: Address; treasuryPoolAddress: Address; walletAddress: Address;
};

export function assertAddress(
  actual: Address, expected: Address, label: string
): void {
  if (!actual.equals(expected)) {
    throw new Error(`${label} address mismatch`);
  }
}

function assertGiverCore(
  data: GiverCoreData, expectedWallet: Address, label: string,
  infrastructure: InfrastructureContracts, graph: TokenGraphContracts
): void {
  assertAddress(data.masterAddress, graph.domMaster.address, `${label} master`);

  assertAddress(
    data.treasuryPoolAddress, infrastructure.treasuryPool.address,
    `${label} TreasuryPool`
  );

  assertAddress(data.walletAddress, expectedWallet, `${label} wallet`);
}

export async function assertGiverRouting(
  graph: TokenGraphContracts, infrastructure: InfrastructureContracts,
  distribution: DomDistributionAddresses
): Promise<void> {
  const [allodium, defi, dao, dominum] = await Promise.all([
    graph.giverAllodium.getGiverData(), graph.giverDefi.getGiverData(),
    graph.giverDao.getGiverData(), graph.giverDominum.getGiverData(),
  ]);

  const [allodiumWallet, defiWallet, daoWallet, dominumWallet] =
    await Promise.all([
      graph.domMaster.getWalletAddress(graph.giverAllodium.address),
      graph.domMaster.getWalletAddress(graph.giverDefi.address),
      graph.domMaster.getWalletAddress(graph.giverDao.address),
      graph.domMaster.getWalletAddress(graph.giverDominum.address),
    ]);

  assertGiverCore(
    allodium, allodiumWallet, 'GiverAllodium', infrastructure, graph
  );

  assertGiverCore(defi, defiWallet, 'GiverDefi', infrastructure, graph);
  assertGiverCore(dao, daoWallet, 'GiverDao', infrastructure, graph);

  assertGiverCore(
    dominum, dominumWallet, 'GiverDominum', infrastructure, graph
  );

  assertAddress(
    allodium.frsAllodiumAddress, distribution.frsAllodium, 'Allodium FRS'
  );

  assertAddress(
    allodium.allodiumFoundationAddress,
    distribution.allodiumFoundation, 'Allodium Foundation'
  );

  assertAddress(defi.marketAddress, distribution.defiMarket, 'DeFi Market');
  assertAddress(defi.foundryAddress, distribution.defiFoundry, 'DeFi Foundry');

  assertAddress(
    defi.defiTreasuryAddress, distribution.defiTreasury, 'DeFi Treasury'
  );

  assertAddress(dao.bankDaoAddress, distribution.daoBank, 'DAO Bank');

  assertAddress(
    dao.daoFoundationAddress, distribution.daoFoundation, 'DAO Foundation'
  );

  assertAddress(
    dominum.bankDominumAddress, distribution.dominumBank, 'Dominum Bank'
  );

  assertAddress(
    dominum.dominumFoundationAddress,
    distribution.dominumFoundation, 'Dominum Foundation'
  );
}

type NamedAddress = {
  label: string;
  address: Address;
};

function named(values: Record<string, Address>): NamedAddress[] {
  return Object.entries(values).map(
    ([label, address]) => ({ label, address })
  );
}

function assertUnique(items: NamedAddress[], label: string): void {
  const unique = new Set(
    items.map((item) => item.address.toRawString())
  );

  if (unique.size !== items.length) {
    throw new Error(`${label} addresses intersect`);
  }
}

function assertDisjoint(
  left: NamedAddress[],
  right: NamedAddress[],
  label: string
): void {
  const rightValues = new Set(
    right.map((item) => item.address.toRawString())
  );
  const intersection = left.find(
    (item) => rightValues.has(item.address.toRawString())
  );

  if (intersection) {
    throw new Error(`${label}: ${intersection.label}`);
  }
}

async function assertActiveCode(
  provider: NetworkProvider,
  item: NamedAddress,
  expectedHash?: Buffer
): Promise<void> {
  const state = await provider.getContractState(item.address);

  if (state.state.type !== 'active' || !state.state.code) {
    throw new Error(`${item.label} is not an active contract`);
  }

  if (!expectedHash) {
    return;
  }

  const cells = Cell.fromBoc(state.state.code);

  if (cells.length !== 1 || !cells[0].hash().equals(expectedHash)) {
    throw new Error(`${item.label} code hash mismatch`);
  }
}

export async function assertRecipientTopologyAndCode(
  provider: NetworkProvider,
  infrastructure: InfrastructureContracts,
  graph: TokenGraphContracts,
  distribution: DomDistributionAddresses,
  controls: DomRecipientControls,
  compiled: CompiledContracts
): Promise<void> {
  const recipients = named({
    frsAllodium: distribution.frsAllodium,
    allodiumFoundation: distribution.allodiumFoundation,
    defiMarket: distribution.defiMarket,
    defiFoundry: distribution.defiFoundry,
    defiTreasury: distribution.defiTreasury,
    daoBank: distribution.daoBank,
    daoFoundation: distribution.daoFoundation,
    dominumBank: distribution.dominumBank,
    dominumFoundation: distribution.dominumFoundation,
  });
  const owners = named({
    frsOwner: controls.frsOwner,
    allodiumFoundationOwner: controls.allodiumFoundationOwner,
    marketOwner: controls.marketOwner,
    foundryOwner: controls.foundryOwner,
    defiBankOwner: controls.defiBankOwner,
    daoBankOwner: controls.daoBankOwner,
    daoFoundationOwner: controls.daoFoundationOwner,
    dominumBankOwner: controls.dominumBankOwner,
    dominumFoundationOwner: controls.dominumFoundationOwner,
  });
  const core = named({
    deployer: infrastructure.deployer,
    treasuryManager: infrastructure.treasuryManager.address,
    treasuryPool: infrastructure.treasuryPool.address,
    gasPool: infrastructure.gasPool.address,
    giverManager: graph.giverManager.address,
    minterManager: graph.minterManager.address,
    minter: graph.minter.address,
    domMaster: graph.domMaster.address,
    giverAllodium: graph.giverAllodium.address,
    giverDefi: graph.giverDefi.address,
    giverDao: graph.giverDao.address,
    giverDominum: graph.giverDominum.address,
  });
  const coreContracts = core.slice(1);
  const dependencies = named({
    allodMaster: controls.allodMaster,
    defiFoundation: controls.defiFoundation,
    foundryRelease: controls.foundryRelease,
  });

  assertUnique(recipients, 'Recipient');
  assertUnique(owners, 'Recipient owner');
  assertUnique(core, 'Core role');
  assertUnique(dependencies, 'Recipient dependency');
  assertDisjoint(recipients, owners, 'Recipient is also its owner');
  assertDisjoint(recipients, core, 'Recipient intersects a core role');
  assertDisjoint(owners, core, 'Recipient owner intersects a core role');
  assertDisjoint(owners, dependencies, 'Owner intersects a dependency');

  const expectedWorkchain = graph.domMaster.address.workChain;
  const invalid = [...recipients, ...owners, ...dependencies].find(
    (item) => item.address.workChain !== expectedWorkchain
  );

  if (invalid) {
    throw new Error(`${invalid.label} uses an unexpected workchain`);
  }

  const recipientHashes = [
    compiled.frsAllodiumCode.hash(),
    compiled.allodiumFoundationCode.hash(),
    compiled.marketMakerCode.hash(),
    compiled.foundryLockCode.hash(),
    compiled.bankDefiCode.hash(),
    compiled.bankDaoCode.hash(),
    compiled.daoFoundationCode.hash(),
    compiled.bankDominumCode.hash(),
    compiled.dominumFoundationCode.hash(),
  ];
  const coreHashes = [
    compiled.treasuryManagerCode.hash(),
    compiled.treasuryPoolCode.hash(),
    compiled.gasPoolCode.hash(),
    compiled.giverManagerCode.hash(),
    compiled.minterManagerCode.hash(),
    compiled.minterCode.hash(),
    compiled.masterCode.hash(),
    compiled.giverAllodiumCode.hash(),
    compiled.giverDefiCode.hash(),
    compiled.giverDaoCode.hash(),
    compiled.giverDominumCode.hash(),
  ];

  await Promise.all([
    ...coreContracts.map(
      (item, index) => assertActiveCode(
        provider,
        item,
        coreHashes[index]
      )
    ),
    ...recipients.map(
      (item, index) => assertActiveCode(
        provider,
        item,
        recipientHashes[index]
      )
    ),
    ...owners.map(
      (item) => assertActiveCode(
        provider,
        item,
        controls.ownerCodeHash
      )
    ),
    ...dependencies.map(
      (item) => assertActiveCode(provider, item)
    ),
  ]);
}
