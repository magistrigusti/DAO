import {
  Cell,
  OpenedContract,
  toNano,
} from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';

import {
  ALLODIUM_DEPLOY_VALUES,
  ALLODIUM_DEFAULTS,
  FORWARDED_MESSAGE_WAIT_MS,
} from '../core/config';
import { sleep } from '../core/helpers';

import {
  AllodMaster,
} from '../../../wrappers/Allodium/allod/AllodMaster';
import {
  AllodGasPool,
} from '../../../wrappers/Allodium/pools/AllodGasPool';

export type ConfigureAllodGasPoolOptions = {
  gasPool: OpenedContract<AllodGasPool>;
  allodMaster: OpenedContract<AllodMaster>;
  walletCode: Cell;
  transferFeeAllod?: bigint;
  topUpValue?: bigint;
  queryIdBase?: bigint;
};

export async function configureAllodGasPool(
  provider: NetworkProvider,
  options: ConfigureAllodGasPoolOptions
): Promise<void> {
  const ui = provider.ui();
  const sender = provider.sender();

  const queryIdBase = options.queryIdBase ?? 700n;
  const transferFeeAllod =
    options.transferFeeAllod ??
    ALLODIUM_DEFAULTS.transferFeeAllod;

  ui.write('--- Configure AllodGasPool master config ---');

  await options.gasPool.sendInitMasterConfig(
    sender,
    {
      value: toNano(ALLODIUM_DEPLOY_VALUES.allodGasPoolConfig),
      masterAddress: options.allodMaster.address,
      jettonWalletCode: options.walletCode,
      queryId: queryIdBase + 1n,
    }
  );

  await provider.waitForLastTransaction();
  await sleep(FORWARDED_MESSAGE_WAIT_MS);

  ui.write('AllodGasPool master config initialized.');

  ui.write('--- Configure AllodGasPool ALLOD fee ---');

  await options.gasPool.sendChangeTransferFee(
    sender,
    {
      value: toNano(ALLODIUM_DEPLOY_VALUES.service),
      newTransferFeeAllod: transferFeeAllod,
      queryId: queryIdBase + 2n,
    }
  );

  await provider.waitForLastTransaction();

  const topUpValue =
    options.topUpValue ??
    toNano(ALLODIUM_DEPLOY_VALUES.allodGasPoolTopUp);

  if (topUpValue > 0n) {
    ui.write('--- Top up AllodGasPool TON balance ---');

    await options.gasPool.sendTopUp(
      sender,
      {
        value: topUpValue,
        queryId: queryIdBase + 3n,
      }
    );

    await provider.waitForLastTransaction();
  }

  const data = await options.gasPool.getAllodGasPoolData();

  ui.write(
    `AllodGasPool fee ALLOD units: ${data.transferFeeAllod.toString()}`
  );
  ui.write(
    `AllodGasPool TON balance: ${data.tonBalance.toString()}`
  );
}