// ========== API: АДРЕСА КОНТРАКТОВ ==========
// GET — получить сохранённые адреса
// POST — сохранить/обновить адреса
// =============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../lib/mongodb';

export interface StoredContracts {
  master?: string;
  gasProxy?: string;
  gasPool?: string;
  giverAllodium?: string;
  giverDefi?: string;
  giverDao?: string;
  giverDominum?: string;
  network?: 'mainnet' | 'testnet';
  updatedAt?: Date;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const db = await getDb();
    const col = db.collection<StoredContracts & { _id?: string }>('contracts');

    if (req.method === 'GET') {
      const doc = await col.findOne({});
      if (!doc) {
        return res.status(200).json({});
      }
      const { _id, ...rest } = doc;
      return res.status(200).json(rest);
    }

    if (req.method === 'POST') {
      const body = req.body as Partial<StoredContracts>;
      const doc = {
        ...body,
        updatedAt: new Date(),
      };
      await col.updateOne(
        {},
        { $set: doc },
        { upsert: true }
      );
      return res.status(200).json(doc);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('api/contracts:', e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'Internal server error',
    });
  }
}
