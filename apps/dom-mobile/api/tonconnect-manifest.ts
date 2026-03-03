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

  const baseClean = base.replace(/\/$/, '');
  const manifest = {
    url: baseClean,
    name: 'DOM Mobile',
    iconUrl: `${baseClean}/favicon.ico`,
    termsOfUseUrl: baseClean,
    privacyPolicyUrl: baseClean,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json(manifest);
}
