import {
  NetworkProvider,
} from '@ton/blueprint';

import {
  loadDomSignerAddresses,
} from '../core/config';
import { compileContracts } from './compileContracts';
import { deployInfrastructure } from '../foundation/deployInfrastructure';
import { deployTokenGraph } from './deployTokenGraph';

export async function run(
  provider: NetworkProvider
) {
  const ui = provider.ui();
  const sender = provider.sender();
  const deployer = sender.address;

  if (!deployer) {
      throw new Error(
          'Sender address is not available'
      );
  }

  ui.write('========== DOM DEPLOY START ==========');
  ui.write(
      `Deployer: ${deployer.toString()}`
  );

  const signers = loadDomSignerAddresses();

  const compiled = await compileContracts(
      provider
  );

  const infrastructure =
      await deployInfrastructure(
          provider,
          compiled,
          deployer,
          signers
      );

  const graph = await deployTokenGraph(
      provider,
      compiled,
      infrastructure,
      signers
  );

  ui.write(
    'Контракты развёрнуты без автоматической подмены ролей.'
  );
  ui.write(
    'Запросы Manager и подтверждения Master выполняются отдельными signer-кошельками.'
  );
  ui.write(
    'Первый mint заблокирован до подтверждения реальных Minter/Giver и настройки GasPool.'
  );
  ui.write(
    `DomMaster: ${graph.domMaster.address.toString()}`
  );
  ui.write(
    `GasRouter: ${infrastructure.gasRouter.address.toString()}`
  );
  ui.write(
    `GasPool: ${infrastructure.gasPool.address.toString()}`
  );

  ui.write('========== DOM DEPLOY END ==========');
}
