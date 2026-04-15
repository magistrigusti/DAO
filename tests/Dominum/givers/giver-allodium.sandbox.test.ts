/// <reference types="jest" />
import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import {
  beginCell,
  Cell,
  toNano,
} from '@ton/core';
import { compile } from '@ton/blueprint';
import { DomMaster } from '../../../wrappers/Dominum/dom/DomMaster';
import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';
import { GasPool } from '../../../wrappers/Dominum/treasury/GasPool';
import { GasProxy } from '../../../wrappers/Dominum/treasury/GasProxy';
import { GiverAllodium } from '../../../wrappers/Dominum/givers/GiverAllodium';

const DOM_MASTER = 'Dominum/dom/DomMaster' as const;
const DOM_WALLET = 'Dominum/dom/DomWallet' as const;
const GAS_PROXY = 'Dominum/treasury/GasProxy' as const;
const GAS_POOL = 'Dominum/treasury/GasPool' as const;
const GIVER_ALLODIUM = 'Dominum/givers/GiverAllodium' as const;
const TESTNET_FIRST_MINT = 1_000_000_000_000n;
const EXPECTED_TARGET_BALANCE = 149_850_000_000n;
const EXPECTED_TREASURY_BALANCE = 200_000_000n;
const EXPECTED_POOL_FEE_BALANCE = 100_000_000n;

async function ignoreFailure(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {}
}

describe('GiverAllodium', () => {
  let blockchain: Blockchain;

  let
})