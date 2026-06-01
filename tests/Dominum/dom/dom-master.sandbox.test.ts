/// <reference types="jest" />

import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
} from '@ton/sandbox';
import {
  beginCell,
  Cell,
} from '@ton/core';
import { compile } from '@ton/blueprint';

import { DomMaster } from '../../../wrappers/Dominum/dom/DomMaster';
import { DomWallet } from '../../../wrappers/Dominum/dom/DomWallet';

import {
  DOM_COMPILE,
  DOM_CONTRACT,
  DOM_FIXTURE,
  DOM_QUERY,
  DOM_STATE,
  DOM_VALUE,
  calculateShare,
} from '../core/_helpers/dom-test-values';
import {
  expectAddress,
  ignoreFailure,
} from '../core/_helpers/dom-test-utils';

describe('DomMaster', () => {
  
})
