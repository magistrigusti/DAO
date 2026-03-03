// ========== API: ИЗОБРАЖЕНИЕ ТОКЕНА ==========
// Раздача test_net_dom_img.jpg для TEP-64 metadata
// URL: /api/image/test_net_dom_img.jpg
// =============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import path from 'path';
import fs from 'fs';

const ALLOWED = ['test_net_dom_img.jpg'];

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const name = req.query.name as string;
  if (!name || !ALLOWED.includes(name)) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400');

  try {
    const base = path.join(process.cwd(), 'static');
    const filePath = path.join(base, name);
    const buf = fs.readFileSync(filePath);
    res.setHeader('Content-Type', 'image/jpeg');
    return res.status(200).send(buf);
  } catch {
    return res.status(404).json({ error: 'Image not found' });
  }
}
