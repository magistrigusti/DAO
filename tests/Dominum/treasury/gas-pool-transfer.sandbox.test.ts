import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, Address } from '@ton/core';
import { printTransactionFees } from '@ton/sandbox';
import { DomMaster } from '../../../wrappers/DomMaster';
import { DomWallet } from '../../../wrappers/DomWallet';
import { GasPool } from '../../../wrappers/GasPool';
import { GasProxy } from '../../../wrappers/GasProxy';
import { compile } from '@ton/blueprint';