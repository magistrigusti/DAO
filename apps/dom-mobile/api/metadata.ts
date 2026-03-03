// ========== API: МЕТАДАННЫЕ ТОКЕНА DOM ==========
// Замена metadata-server. TEP-64 off-chain JSON.
// URL: /dom-metadata.json (rewrite) или /api/metadata
// =================================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const base = `${protocol}://${host}`;

  const metadata = {
    name: 'Dv1',
    symbol: 'DOM',
    decimals: '6',
    description:
      'Dominum v1 — токен DAO для сбора средств на остров. Острова, энергия астрала, дом для нейросетей.',
    image: `${base}/api/image/test_net_dom_img.jpg`,
  };

  return res.status(200).json(metadata);
}
