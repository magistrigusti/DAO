import {
  Address,
  Cell,
  OpenedContract,
} from '@ton/core';

import { DomMaster } from '../../../wrappers/Dominum/dom/DomMaster';
import { GasPool } from '../../../wrappers/Dominum/pools/GasPool';
import { TreasuryPool } from '../../../wrappers/Dominum/treasury/TreasuryPool';
import { Minter } from '../../../wrappers/Dominum/treasury/Minter';

import {
  GiverAllodium,
} from '../../../wrappers/Dominum/givers/GiverAllodium';
import {
  GiverDefi,
} from '../../../wrappers/Dominum/givers/GiverDefi';
import {
  GiverDao,
} from '../../../wrappers/Dominum/givers/GiverDao';
import {
  GiverDominum,
} from '../../../wrappers/Dominum/givers/GiverDominum';
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
  FrsAllodium,
} from '../../../wrappers/Allodium/treasury/FrsAllodium';
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

export type CompiledContracts = {
  walletCode: Cell;
  masterCode: Cell;

  treasuryManagerCode: Cell;
  treasuryPoolCode: Cell;
  gasPoolCode: Cell;

  minterCode: Cell;
  minterManagerCode: Cell;

  giverAllodiumCode: Cell;
  giverDefiCode: Cell;
  giverDaoCode: Cell;
  giverDominumCode: Cell;
  giverManagerCode: Cell;

  frsAllodiumCode: Cell;
  allodiumFoundationCode: Cell;
  marketMakerCode: Cell;
  foundryLockCode: Cell;
  bankDefiCode: Cell;
  bankDaoCode: Cell;
  daoFoundationCode: Cell;
  bankDominumCode: Cell;
  dominumFoundationCode: Cell;
};

export type InfrastructureContracts = {
  deployer: Address;
  treasuryManager: OpenedContract<TreasuryManager>;
  treasuryPool: OpenedContract<TreasuryPool>;
  gasPool: OpenedContract<GasPool>;
};

export type TokenGraphContracts = {
  giverManager: OpenedContract<GiverManager>;
  minterManager: OpenedContract<MinterManager>;

  minter: OpenedContract<Minter>;
  domMaster: OpenedContract<DomMaster>;

  giverAllodium: OpenedContract<GiverAllodium>;
  giverDefi: OpenedContract<GiverDefi>;
  giverDao: OpenedContract<GiverDao>;
  giverDominum: OpenedContract<GiverDominum>;
};

export type PreGraphRecipientContracts = {
  frsAllodium: OpenedContract<FrsAllodium>;
  allodiumFoundation: OpenedContract<AllodiumFoundation>;
  defiMarket: OpenedContract<MarketMaker>;
  defiFoundry: OpenedContract<FoundryLock>;
  defiTreasury: OpenedContract<BankDefi>;
  daoBank: OpenedContract<BankDao>;
  daoFoundation: OpenedContract<DaoFoundation>;
  dominumFoundation: OpenedContract<DominumFoundation>;
};

export type DomRecipientContracts = PreGraphRecipientContracts & {
  dominumBank: OpenedContract<BankDominum>;
};
