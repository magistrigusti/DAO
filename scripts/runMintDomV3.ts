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
    loadDomDeploymentAddresses,
    loadDomDistributionAddresses,
} from './Dominum/core/config';
import {
    InfrastructureContracts,
    TokenGraphContracts,
} from './Dominum/core/types';
import {
    mintAndReport,
} from './Dominum/foundation/mintAndReport';
import {
    createDomProvider,
} from './runtime/toncenter-v3/DomProvider';

async function main(): Promise<void> {
    const provider =
        await createDomProvider();

    const addresses =
        loadDomDeploymentAddresses();

    const distribution =
        loadDomDistributionAddresses();

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
        ),
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
        ),
    };

    await mintAndReport(
        provider,
        infrastructure,
        graph,
        distribution
    );
}

void main().catch(
    (error) => {
        console.error(error);
        process.exit(1);
    }
);