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

    const [
        master, pending, givers, gas, treasury, minter, allodium, defi, dao, dominum
    ] = await Provise.all(
        [
            graph.domMaster.getMasterData(),
            graph.domMaster.getMasterPendingRequest(),
            graph.domMaster.getGiversData(),
            infrastructure.gasPool.getGasPoolData(),
            infrastructure.treasuryPool.getTreasuryPoolData(),
            graph.minter.getMinterData(),
            graph.giverAllodium.getGiverData(),
            graph.giverDefi.getGiverData(),
            graph.giverDao.getGiverData(),
            graph.giverDominum.getGiverData(),
        ]
    );

    provider.ui().write('DOM CONFIGURATION STATUS');

    printFlag(
        provider,
        'Minter role',
        sameAddress(
            master.minterAddress,
            graph.minter.address
        )
    );

    printFlag(
        provider,
        "minter master",
        sameAddress(
            minter.masterAddress,
            graph.domMaster.address
        )
    );

    printFlag(
        provider,
        'GiverAllodium role',
        sameAddress(
            givers.givberAllodiumAddress,
            graph.giverAllodium.address
        )
    );

    printFlag(
        provider,
        'GiverDefi role',
        sameAddress(
            givers.giverDefiAddress,
            graph.giverDefi.address
        )
    );

    printFlag(
        provider,
        'GiverDao role',
        sameAddress(
            givers.giverDaoAddress,
            graph.giverDao.address
        )
    );

    printFlag(
        provider,
        'GiverDominum role',
        sameAddress(
            givers.giverDominumAddress,
            graph.giverDominum.address
        )
    );

    printFlag(
        provider,
        'Master request empty',
        !pending.hasPending
    );

    printFlag(
        provider,
        'Treasury GasPool',
        sameAddress(
            treasury.gasPoolAddress,
            infrastructure.gasPool.address
        )
    );

    printFlag(
        provider,
        "GasPool configured",
        gas.masterConfigured
    );

    printFlag(
        provider,
        'GasPool master',
        sameAddress(
            gas.masterAddress,
            graph.domMaster.address
        )
    );

    printFlag(
        provider,
        'Treasury wallet',
        treasury.walletConfigured
    );

    printFlag(
        provider,
        'Allodium FRS',
        sameAddress(
            allodium.frsAllodiumAddress,
            distribution.frsAllodium
        )
    );

    printFlag(
        provider,
        'Allodium Foundation',
        sameAddress(
            allodium.allodiumFoundationAddress,
            distribution.allodiumFoundation
        )
    );

    printFlag(
        provider,
        'Defi Market',
        sameAddress(
            defi.marketAddress,
            distribution.defiMarket
        )
    );

    printFlag(
        provider,
        'Defi Foundry',
        sameAddress(
            defi.foundryAddress,
            distribution.defiFoundry
        )
    );

    printFlag(
        provider,
        'Defi Treasury',
        sameAddress(
            defi.defiTreasuryAddress,
            distribution.defiTreasury
        )
    );

    printFlag(
        provider,
        'DAO Bank',
        sameAddress(
            dao.bankDaoAddress,
            distribution.daoBank
        )
    );

    printFlag(
        provider,
        'DAO Foundation',
        sameAddress(
            dao.daoFoundationAddress,
            distribution.daoFoundation
        )
    );

    printFlag(
        provider,
        'Dominum Bank',
        sameAddress(
            dominum.bankDominumAddress,
            distribution.dominumBank
        )
    );

    printFlag(
        provider,
        'Dominum Foundation',
        sameAddress(
            dominum.dominumFoundationAddress,
            distribution.dominumFoundation
        )
    );
}