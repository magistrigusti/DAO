import { Cell } from '@ton/core';
import { DOM_METADATA, METADATA_URL } from '../core/config';
import { buildOffChainContent } from '../core/helpers';

type MetadataDocument = Record<string, unknown>;

function requireString(
  document: MetadataDocument,
  key: string
): string {
  const value = document[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`DOM metadata ${key} must be a non-empty string`);
  }

  return value;
}

export function assertMetadataDocument(value: unknown): MetadataDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('DOM metadata response must be a JSON object');
  }

  const document = value as MetadataDocument;
  const name = requireString(document, 'name');
  const symbol = requireString(document, 'symbol');
  const decimals = requireString(document, 'decimals');
  const image = requireString(document, 'image');

  if (name !== DOM_METADATA.name) {
    throw new Error(`DOM metadata name must be ${DOM_METADATA.name}`);
  }

  if (symbol !== DOM_METADATA.symbol) {
    throw new Error(`DOM metadata symbol must be ${DOM_METADATA.symbol}`);
  }

  if (decimals !== DOM_METADATA.decimals) {
    throw new Error(
      `DOM metadata decimals must be ${DOM_METADATA.decimals}`
    );
  }

  const imageUrl = new URL(image);

  if (imageUrl.protocol !== 'https:') {
    throw new Error('DOM metadata image must use HTTPS');
  }

  return document;
}

async function requireReachable(url: string, label: string): Promise<void> {
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}`);
  }

  await response.body?.cancel();
}

export async function assertDomMetadata(
  onChainContent: Cell
): Promise<void> {
  const expected = buildOffChainContent(METADATA_URL);

  if (!onChainContent.hash().equals(expected.hash())) {
    throw new Error('DomMaster metadata URI cell does not match config');
  }

  const response = await fetch(METADATA_URL, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`DOM metadata returned HTTP ${response.status}`);
  }

  const document = assertMetadataDocument(await response.json());
  await requireReachable(requireString(document, 'image'), 'DOM image');
}
