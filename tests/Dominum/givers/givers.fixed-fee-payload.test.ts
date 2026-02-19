import { test } from 'node:test';
import {
    assertMatches,
    assertNotContains,
    readContract,
} from '../core/test-utils';

const giverPaths = [
    'contracts/Dominum/givers/giver_allodium.tolk',
    'contracts/Dominum/givers/giver_defi.tolk',
    'contracts/Dominum/givers/giver_dao.tolk',
    'contracts/Dominum/givers/giver_dominum.tolk',
];

test('givers: не используют custom payload для fee', () => {
    for (const giverPath of giverPaths) {
        const source = readContract(giverPath);

        assertNotContains(source, 'FEE_MAGIC', giverPath);
        assertNotContains(
            source,
            '.storeBool(true)',
            giverPath
        );

        assertMatches(
            source,
            /\.storeBool\(false\)\s*\.storeCoins\(0\)\s*\.storeBool\(false\)/m,
            giverPath,
            'ожидался TEP-74 transfer без custom_payload'
        );
    }
});
