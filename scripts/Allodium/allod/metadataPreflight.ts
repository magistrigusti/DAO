import { Cell } from '@ton/core';
import {
  ALLODIUM_METADATA,
  ALLODIUM_METADATA_URL,
} from '../core/config';
import { buildOffChainContent } from '../core/helpers';

type MetadataDocument = Record<string, unknown>;

function requireString(
  document: MetadataDocument,
  key: string
): string {
  const value = document[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `ALLOD metadata ${key} must be a non-empty string`
    );
  }

  return value;
}

function requireExpected(
  document: MetadataDocument,
  key: keyof typeof ALLODIUM_METADATA
): void {
  const value = requireString(document, key);
  const expected = ALLODIUM_METADATA[key];

  if (value !== expected) {
    throw new Error(`ALLOD metadata ${key} must be ${expected}`);
  }
}

export function assertAllodiumMetadataDocument(
  value: unknown
): MetadataDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('ALLOD metadata response must be a JSON object');
  }

  const document = value as MetadataDocument;

  requireExpected(document, 'name');
  requireExpected(document, 'symbol');
  requireExpected(document, 'decimals');
  requireExpected(document, 'description');
  requireExpected(document, 'image');

  const imageUrl = new URL(requireString(document, 'image'));

  if (imageUrl.protocol !== 'https:') {
    throw new Error('ALLOD metadata image must use HTTPS');
  }

  return document;
}

async function requireReachable(
  url: string,
  label: string,
  contentTypePrefix?: string
): Promise<void> {
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentTypePrefix && !contentType.startsWith(contentTypePrefix)) {
    throw new Error(`${label} returned ${contentType || 'no MIME type'}`);
  }

  await response.body?.cancel();
}

export async function assertAllodiumMetadata(
  onChainContent: Cell,
  metadataUrl: string = ALLODIUM_METADATA_URL
): Promise<void> {
  const parsedUrl = new URL(metadataUrl);

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('ALLOD metadata URL must use HTTPS');
  }

  const expected = buildOffChainContent(parsedUrl.toString());

  if (!onChainContent.hash().equals(expected.hash())) {
    throw new Error('AllodMaster metadata URI cell does not match config');
  }

  const response = await fetch(parsedUrl, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`ALLOD metadata returned HTTP ${response.status}`);
  }

  const document = assertAllodiumMetadataDocument(
    await response.json()
  );
  const image = requireString(document, 'image');

  await requireReachable(image, 'ALLOD image', 'image/');
}
