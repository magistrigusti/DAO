import { Address, OpenedContract, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';

import { DEPLOY_VALUES, DomDistributionAddresses } from '../core/config';
import { CompiledContracts } from '../core/types';

import { GiverAllodium } from '../../../wrappers/Dominum/givers/GiverAllodium';
import { GiverDefi } from '../../../wrappers/Dominum/givers/GiverDefi';
import { GiverDao } from '../../../wrappers/Dominum/givers/GiverDao';
import { GiverDominum } from '../../../wrappers/Dominum/givers/GiverDominum';

export type DeployedGivers = {
  giverAllodium: OpenedContract<GiverAllodium>;
  giverDefi: OpenedContract<GiverDefi>;
}