import {
  Address,
  Cell,
  OpenedContract,
} from '@ton/core';

import {
  AllodMaster,
} from '../../../wrappers/Allodium/allod/AllodMaster';
import {
  AllodGasPool,
} from '../../../wrappers/Allodium/pools/AllodGasPool';
import {
  FrsAllodium,
} from '../../../wrappers/Allodium/treasury/FrsAllodium';
import {
  AllodiumFoundation,
} from '../../../wrappers/Allodium/foundation/AllodiumFoundation';

export type CompiledAllodiumContracts = {
  allodMasterCode: Cell;
  allodWalletCode: Cell;
  allodGasPoolCode: Cell;
  frsAllodiumCode: Cell;
  allodiumFoundationCode: Cell;
};

export type AllodiumInfrastructureContracts = {
  deployer: Address;
  allodGasPool: OpenedContract<AllodGasPool>;
  frsAllodium: OpenedContract<FrsAllodium>;
  allodiumFoundation: OpenedContract<AllodiumFoundation>;
};

export type AllodiumTokenGraphContracts = {
  allodMaster: OpenedContract<AllodMaster>;
};

export type CompiledContracts = CompiledAllodiumContracts;
export type InfrastructureContracts = AllodiumInfrastructureContracts;
export type TokenGraphContracts = AllodiumTokenGraphContracts;