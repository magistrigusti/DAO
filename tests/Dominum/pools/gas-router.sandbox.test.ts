/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import { Cell } from '@ton/core';
import { compile } from '@ton/blueprint';

import {
  GasRouter,
} from '../../../wrappers/Dominum/pools/GasRouter';
import {
  DOM_COMPILE,
  DOM_QUERY,
  DOM_VALUE,
} from '../_helpers/dom-test-values';
import {
  expectAddress,
  ignoreFailure,
} from '../core/dom-test-utils';

describe('GasRouter', () => {
  let blockchain: Blockchain;

  let bootstrapController: SandboxContract<TreasuryContract>;
  let treasuryPool: SandboxContract<TreasuryContract>;
  let oldGasPool: SandboxContract<TreasuryContract>;
  let newGasPool: SandboxContract<TreasuryContract>;
  let outsider: SandboxContract<TreasuryContract>;

  let gasRouterCode: Cell;

  beforeAll(async () => {
    gasRouterCode = await compile(DOM_COMPILE.gasRouter);
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    bootstrapController =
      await blockchain.treasury('bootstrap-controller');
    treasuryPool = await blockchain.treasury('treasury-pool');
    oldGasPool = await blockchain.treasury('old-gas-pool');
    newGasPool = await blockchain.treasury('new-gas-pool');
    outsider = await blockchain.treasury('outsider');
  });

  async function deployRouter() {
    const gasRouter = blockchain.openContract(
      GasRouter.createFromConfig(
        {
          controllerAddress: bootstrapController.address,
          activeGasPoolAddress: oldGasPool.address,
        },
        gasRouterCode
      )
    );

    await gasRouter.sendDeploy(
      bootstrapController.getSender(),
      DOM_VALUE.deploySmall
    );

    return gasRouter;
  }

  it('should expose stable controller and active GasPool', async () => {
    const gasRouter = await deployRouter();
    const data = await gasRouter.getGasRouterData();

    expectAddress(
      data.controllerAddress,
      bootstrapController.address
    );
    expectAddress(
      data.activeGasPoolAddress,
      oldGasPool.address
    );
    expect(data.controllerConfigured).toBe(false);
  });

  it('should transfer control once and accept GasPool changes only from controller', async () => {
    const gasRouter = await deployRouter();

    await gasRouter.sendSetController(
      bootstrapController.getSender(),
      {
        value: DOM_VALUE.config,
        controllerAddress: treasuryPool.address,
        queryId: DOM_QUERY.treasuryAddressRequest,
      }
    );

    await ignoreFailure(
      gasRouter.sendSetActiveGasPool(
        outsider.getSender(),
        {
          value: DOM_VALUE.config,
          activeGasPoolAddress: newGasPool.address,
          queryId: DOM_QUERY.treasuryAddressRejected,
        }
      )
    );

    let data = await gasRouter.getGasRouterData();

    expectAddress(
      data.activeGasPoolAddress,
      oldGasPool.address
    );

    await gasRouter.sendSetActiveGasPool(
      treasuryPool.getSender(),
      {
        value: DOM_VALUE.config,
        activeGasPoolAddress: newGasPool.address,
        queryId: DOM_QUERY.treasuryAddressConfirm,
      }
    );

    data = await gasRouter.getGasRouterData();

    expectAddress(
      data.controllerAddress,
      treasuryPool.address
    );
    expectAddress(
      data.activeGasPoolAddress,
      newGasPool.address
    );
    expect(data.controllerConfigured).toBe(true);
  });
});
