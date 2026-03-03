// ========== API: WHITELIST АДРЕСОВ ==========
// GET — список адресов и их ролей (deploy, mint, monitor, assets, settings)
// POST — добавить/обновить адрес с ролями
// Если whitelist пуст — все подключённые видят все действия
// =============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../lib/mongodb';

export type WalletRole = 'deploy' | 'mint' | 'monitor' | 'assets' | 'settings';

export interface AllowedWallet {
  address: string;
  roles: WalletRole[];
  addedAt?: Date;
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
    const col = db.collection<AllowedWallet>('allowedWallets');

    if (req.method === 'GET') {
      const address = req.query.address as string | undefined;
      if (address) {
        const doc = await col.findOne({ address });
        if (!doc) return res.status(200).json({ address, roles: [] });
        return res.status(200).json({ address: doc.address, roles: doc.roles });
      }
      const list = await col.find({}).toArray();
      return res.status(200).json(list);
    }

    if (req.method === 'POST') {
      const body = req.body as { address: string; roles: WalletRole[] };
      if (!body?.address || !Array.isArray(body.roles)) {
        return res.status(400).json({
          error: 'Missing address or roles array',
        });
      }
      await col.updateOne(
        { address: body.address },
        { $set: { ...body, addedAt: new Date() } },
        { upsert: true }
      );
      return res.status(200).json(body);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('api/allowed-wallets:', e);
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'Internal server error',
    });
  }
}
