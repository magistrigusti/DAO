import { Cell, TupleItem, TupleReader } from '@ton/core';

export type ToncenterV3StackArg = {
  type: string;
  value: string;
};

function parseBigIntValue(value: string): bigint {
  if (value.startsWith('-0x')) {
    return -BigInt(`0x${value.slice(3)}`);
  }

  if (value.startsWith('0x')) {
    return BigInt(value);
  }

  return BigInt(value);
}

function readBase64(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object' && 'bytes' in value) {
    const bytes = (value as { bytes?: unknown }).bytes;
    if (typeof bytes === 'string') {
      return bytes;
    }
  }

  throw new Error(`Unsupported BOC value: ${JSON.stringify(value)}`);
}

export function encodeStackItem(item: TupleItem): ToncenterV3StackArg {
  switch (item.type) {
    case 'int':
      return {
        type: 'num',
        value: item.value < 0 ? `-0x${(-item.value).toString(16)}` : `0x${item.value.toString(16)}`,
      };

    case 'cell':
      return {
        type: 'cell',
        value: item.cell.toBoc().toString('base64'),
      };

    case 'slice':
      return {
        type: 'slice',
        value: item.cell.toBoc().toString('base64'),
      };

    case 'builder':
      return {
        type: 'cell',
        value: item.cell.toBoc().toString('base64'),
      };

    default:
      throw new Error(`Unsupported stack arg type for Toncenter v3: ${item.type}`);
  }
}

export function decodeStackItem(item: unknown): TupleItem {
  if (Array.isArray(item) && item.length === 2) {
    const [kind, value] = item;

    if (kind === 'num') {
      return { type: 'int', value: parseBigIntValue(String(value)) };
    }

    if (kind === 'null') {
      return { type: 'null' };
    }

    if (kind === 'cell') {
      return {
        type: 'cell',
        cell: Cell.fromBoc(Buffer.from(readBase64(value), 'base64'))[0],
      };
    }

    if (kind === 'slice') {
      return {
        type: 'slice',
        cell: Cell.fromBoc(Buffer.from(readBase64(value), 'base64'))[0],
      };
    }

    if (kind === 'builder') {
      return {
        type: 'builder',
        cell: Cell.fromBoc(Buffer.from(readBase64(value), 'base64'))[0],
      };
    }

    throw new Error(`Unsupported legacy stack item kind: ${String(kind)}`);
  }

  if (item && typeof item === 'object' && 'type' in item) {
    const typedItem = item as { type: string; value?: unknown };

    if (typedItem.type === 'num') {
      return { type: 'int', value: parseBigIntValue(String(typedItem.value)) };
    }

    if (typedItem.type === 'null') {
      return { type: 'null' };
    }

    if (typedItem.type === 'cell') {
      return {
        type: 'cell',
        cell: Cell.fromBoc(Buffer.from(readBase64(typedItem.value), 'base64'))[0],
      };
    }

    if (typedItem.type === 'slice') {
      return {
        type: 'slice',
        cell: Cell.fromBoc(Buffer.from(readBase64(typedItem.value), 'base64'))[0],
      };
    }
  }

  throw new Error(`Unsupported Toncenter v3 stack item: ${JSON.stringify(item)}`);
}

export function decodeStack(items: unknown[]): TupleReader {
  return new TupleReader(items.map(decodeStackItem));
}