import { toNano } from '@ton/core';
import {
  NetworkProvider,
} from '@ton/blueprint';

import {
  DEPLOY_VALUES,
  FORWARDED_MESSAGE_WAIT_MS,
} from '../core/config';
import { sleep } from '../core/helpers';
import {
  CompiledContracts,
  InfrastructureContracts,
  TokenGraphContracts,
} from '../core/types';