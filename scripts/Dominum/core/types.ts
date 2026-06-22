import {
  Address,
  Cell,
  OpenedContract,
} from '@ton/core';

import { DomMaster } from '../../../wrappers/Dominum/dom/DomMaster';
import { GasPool } from '../../../wrappers/Dominum/pools/GasPool';
import { GasRouter } from '../../../wrappers/Dominum/pools/GasRouter';
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

export type CompiledContracts = {
  walletCode: Cell;
  masterCode: Cell;

  treasuryManagerCode: Cell;
  treasuryPoolCode: Cell;
  gasPoolCode: Cell;
  gasRouterCode: Cell;

  minterCode: Cell;
  minterManagerCode: Cell;

  giverAllodiumCode: Cell;
  giverDefiCode: Cell;
  giverDaoCode: Cell;
  giverDominumCode: Cell;
  giverManagerCode: Cell;
};

export type InfrastructureContracts = {
  deployer: Address;
  treasuryManager: OpenedContract<TreasuryManager>;
  treasuryPool: OpenedContract<TreasuryPool>;
  gasPool: OpenedContract<GasPool>;
  gasRouter: OpenedContract<GasRouter>;
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
