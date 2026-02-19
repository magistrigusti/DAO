import { test } from 'node:test';
import {
    assertContains,
    readContract,
} from './test-utils';

const errorsPath =
    'contracts/Dominum/core/errors.tolk';

test('errors: есть коды для one-time proxy инициализации', () => {
    const source = readContract(errorsPath);

    assertContains(
        source,
        'const ERROR_ALREADY_INITIALIZED: int = 94;',
        errorsPath
    );
    assertContains(
        source,
        'const ERROR_PROXY_NOT_CONFIGURED: int = 95;',
        errorsPath
    );
});
