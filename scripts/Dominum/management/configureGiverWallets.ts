import {
  NetworkProvider,
} from '@ton/blueprint';

import { TokenGraphContracts } from '../core/types';

export async function configureGiverWallets(
  provider: NetworkProvider,
  graph: TokenGraphContracts
): Promise<void> {
  const ui = provider.ui();

  ui.write('--- Step 13: Report giver wallets ---');

  const giverAllodiumWallet =
    await graph.domMaster.getWalletAddress(
      graph.giverAllodium.address
    );

  const giverDefiWallet =
    await graph.domMaster.getWalletAddress(
      graph.giverDefi.address
    );

  const giverDaoWallet =
    await graph.domMaster.getWalletAddress(
      graph.giverDao.address
    );

  const giverDominumWallet =
    await graph.domMaster.getWalletAddress(
      graph.giverDominum.address
    );

  ui.write(
    `GiverAllodium wallet: ${giverAllodiumWallet.toString()}`
  );
  ui.write(
    `GiverDefi wallet: ${giverDefiWallet.toString()}`
  );
  ui.write(
    `GiverDao wallet: ${giverDaoWallet.toString()}`
  );
  ui.write(
    `GiverDominum wallet: ${giverDominumWallet.toString()}`
  );

  ui.write(
    'Giver wallets are derived from DomMaster. No setWallet transaction is needed.'
  );
}