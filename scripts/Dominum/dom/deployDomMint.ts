import {
  Address,
} from '@ton/core';
import {
  NetworkProvider,
  UIProvider,
} from '@ton/blueprint';

import {
  loadDomDistributionAddresses,
  loadDomSignerAddresses,
} from '../core/config';

import { compileContracts } from './compileContracts';
import {
  deployInfrastructure,
} from '../foundation/deployInfrastructure';
import { deployTokenGraph } from './deployTokenGraph';

function writeAddress(
  ui: UIProvider,
  name: string,
  address: Address
): void {
  ui.write(
    `${name}=${address.toString()}`
  );
}