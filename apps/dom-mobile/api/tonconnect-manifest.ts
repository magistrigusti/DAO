// ========== API: TON CONNECT MANIFEST ==========
// Кошельки запрашивают этот JSON при подключении
// URL: /tonconnect-manifest.json (rewrite)
// ==============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const base = `${protocol}://${host}`;

  const manifest = {
    url: `${base}/`,
    name: 'DOM Mobile',
    iconUrl: `${base}/favicon.ico`,
    termsOfUseUrl: `${base}/`,
    privacyPolicyUrl: `${base}/`,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json(manifest);
}
