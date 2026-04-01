import {
  Address,
  Cell,
  OpenedContract,
} from '@ton/core';

import { DomMaster } from '../../../wrappers/Dominum/dom/DomMaster';
import { GasPool } from '../../../wrappers/Dominum/treasury/GasPool';
import { GasProxy } from '../../../wrappers/Dominum/treasury/GasProxy';

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

// ========== COMPILED CODE ==========
export type CompiledContracts = {
  walletCode: Cell;
  masterCode: Cell;
  gasProxyCode: Cell;
  gasPoolCode: Cell;
  giverAllodiumCode: Cell;
  giverDefiCode: Cell;
  giverDaoCode: Cell;
  giverDominumCode: Cell;
  giverManagerCode: Cell;
};

// ========== INFRASTRUCTURE ==========
export type InfrastructureContracts = {
  deployer: Address;
  gasProxy: OpenedContract<GasProxy>;
  gasPool: OpenedContract<GasPool>;
};

// ========== TOKEN GRAPH ==========
export type TokenGraphContracts = {
  giverManager: OpenedContract<GiverManager>;
  giverAllodium: OpenedContract<GiverAllodium>;
  giverDefi: OpenedContract<GiverDefi>;
  giverDao: OpenedContract<GiverDao>;
  giverDominum: OpenedContract<GiverDominum>;
  domMaster: OpenedContract<DomMaster>;
};