import {
    Address,
} from '@ton/core';
import {
    NetworkProvider,
} from '@ton/blueprint';

import {
    DomMaster,
} from '../wrappers/Dominum/dom/DomMaster';
import {
    GasPool,
} from '../wrappers/Dominum/pools/GasPool';
import {
    TreasuryPool,
} from '../wrappers/Dominum/treasury/TreasuryPool';
import {
    Minter,
} from '../wrappers/Dominum/treasury/Minter';
import {
    TreasuryManager,
} from '../wrappers/Dominum/management/TreasuryManager';
import {
    MinterManager,
} from '../wrappers/Dominum/management/MinterManager';
import {
    GiverManager,
} from '../wrappers/Dominum/management/GiverManager';
import {
    GiverAllodium,
} from '../wrappers/Dominum/givers/GiverAllodium';
import {
    GiverDefi,
} from '../wrappers/Dominum/givers/GiverDefi';
import {
    GiverDao,
} from '../wrappers/Dominum/givers/GiverDao';
import {
    GiverDominum,
} from '../wrappers/Dominum/givers/GiverDominum';
import {
    GIVER_TARGET,
} from '../wrappers/Dominum/core/constants';

import {
    FORWARDED_MESSAGE_WAIT_MS,
    loadDomDeploymentAddresses,
    loadDomDistributionAddresses,
} from './Dominum/core/config';
import { sleep } from './Dominum/core/helpers';
import {
    InfrastructureContracts,
    TokenGraphContracts,
} from './Dominum/core/types';
import {
    compileContracts,
} from './Dominum/dom/compileContracts';
import {
    confirmCurrentMasterRequest,
    requestInitialGiver,
    requestInitialMinter,
} from './Dominum/management/configureTokenGraph';
import {
    confirmGasPoolReplacement,
    initializeGasPipeline,
    requestGasPoolReplacement,
} from './Dominum/treasury/configureGasPipeline';
import {
    createDomProvider,
} from './runtime/toncenter-v3/DomProvider';

type Contracts = {
    infrastructure: InfrastructureContracts;
    graph: TokenGraphContracts;
};

function sameAddress(
    actual: Address,
    expected: Address
): boolean {
    return actual.equals(expected);
}

function printFlag(
    provider: NetworkProvider,
    label: string,
    value: boolean
): void {
    provider.ui().write(`${label}: ${value ? 'OK' : 'NO'}`);
}

function openContracts(
    provider: NetworkProvider
): Contracts {
    const addresses = loadDomDeploymentAddresses();

    const infrastructure: InfrastructureContracts = {
        deployer: addresses.deployer,

        treasuryManager: provider.open(
            TreasuryManager.createFromAddress(
                addresses.treasuryManager
            )
        ),

        treasuryPool: provider.open(
            TreasuryPool.createFromAddress(
                addresses.treasuryPool
            )
        ),

        gasPool: provider.open(
            GasPool.createFromAddress(
                addresses.gasPool
            )
        )
    };

    const graph: TokenGraphContracts = {
        giverManager: provider.open(
            GiverManager.createFromAddress(
                addresses.giverManager
            )
        ),

        minterManager: provider.open(
            MinterManager.createFromAddress(
                addresses.minterManager
            )
        ),

        minter: provider.open(
            Minter.createFromAddress(
                addresses.minter
            )
        ),
        domMaster: provider.open(
            DomMaster.createFromAddress(
                addresses.domMaster
            )
        ),

        giverAllodium: provider.open(
            GiverAllodium.createFromAddress(
                addresses.giverAllodium
            )
        ),

        giverDefi: provider.open(
            GiverDefi.createFromAddress(
                addresses.giverDefi
            )
        ),

        giverDao: provider.open(
            GiverDao.createFromAddress(
                addresses.giverDao
            )
        ),

        giverDominum: provider.open(
            GiverDominum.createFromAddress(
                addresses.giverDominum
            )
        )
    };

    return {
        infrastructure,
        graph
    };
}

async function waitForForward(
    provider: NetworkProvider
): Promise<void> {
    await provider.waitForLastTransaction();
    await sleep(FORWARDED_MESSAGE_WAIT_MS);
}

async function printStatus(
    provider: NetworkProvider,
    contracts: Contracts
): Promise<void> {
    const {
        infrastructure,
        graph,
    } = contracts;

    const distribution = loadDomDistributionAddresses();
}