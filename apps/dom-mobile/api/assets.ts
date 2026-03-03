// ========== API: КРИПТО-АКТИВЫ ==========
// GET — список активов
// POST — добавить актив
// =========================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../lib/mongodb';

export interface CryptoAsset {
  _id?: string;
  type: 'jetton' | 'nft';
  symbol: string;
  name: string;
  masterAddress: string;
  network: 'mainnet' | 'testnet';
  metadataUrl?: string;
  createdAt?: Date;
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
    const col = db.collection<CryptoAsset>('assets');

    if (req.method === 'GET') {
      const assets = await col.find({}).sort({ createdAt: -1 }).toArray();
      return res.status(200).json(assets);
    }

    if (req.method === 'POST') {
      const body = req.body as Partial<CryptoAsset>;
      if (!body?.symbol || !body?.name || !body?.masterAddress || !body?.network) {
        return res.status(400).json({
          error: 'Missing required fields: symbol, name, masterAddress, network',
        });
      }
      const doc: CryptoAsset = {
        type: body.type ?? 'jetton',
        symbol: body.symbol,
        name: body.name,
        masterAddress: body.masterAddress,
        network: body.network,
        metadataUrl: body.metadataUrl,
        createdAt: new Date(),
      };
      const result = await col.insertOne(doc);
      return res.status(201).json({ ...doc, _id: result.insertedId.toString() });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('api/assets:', e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'Internal server error',
    });
  }
}
