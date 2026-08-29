/// <reference types="jest" />

import { beginCell } from '@ton/core';
import {
  ALLODIUM_METADATA,
  ALLODIUM_METADATA_URL,
} from '../../../scripts/Allodium/core/config';
import {
  buildOffChainContent,
} from '../../../scripts/Allodium/core/helpers';
import {
  assertAllodiumMetadata,
  assertAllodiumMetadataDocument,
} from '../../../scripts/Allodium/allod/metadataPreflight';

describe('Allodium metadata preflight', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts the canonical test metadata', () => {
    expect(
      assertAllodiumMetadataDocument({ ...ALLODIUM_METADATA })
    ).toEqual(ALLODIUM_METADATA);
  });

  it.each([
    ['name', 'Allodium'],
    ['symbol', 'ALLOD'],
    ['decimals', '9'],
    ['description', 'Wrong description'],
    ['image', 'https://example.test/allod.jpg'],
  ])('rejects a wrong %s field', (key, value) => {
    expect(() => assertAllodiumMetadataDocument({
      ...ALLODIUM_METADATA,
      [key]: value,
    })).toThrow(`ALLOD metadata ${key} must be`);
  });

  it('rejects an on-chain metadata URI mismatch before fetch', async () => {
    await expect(
      assertAllodiumMetadata(beginCell().endCell())
    ).rejects.toThrow(
      'AllodMaster metadata URI cell does not match config'
    );
  });

  it('accepts reachable canonical metadata and image', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(
        JSON.stringify(ALLODIUM_METADATA),
        { status: 200 }
      ))
      .mockResolvedValueOnce(new Response('image', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }));

    await expect(assertAllodiumMetadata(
      buildOffChainContent(ALLODIUM_METADATA_URL)
    )).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
