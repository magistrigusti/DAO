// ========== ГЕНЕРАЦИЯ TON CONNECT MANIFEST ==========
// Запускается после expo export. Манифест — статический JSON в dist/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vercel задаёт VERCEL_URL (например dao-lime-ton.vercel.app)
const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.VERCEL_BRANCH_URL
    ? `https://${process.env.VERCEL_BRANCH_URL}`
    : 'https://dao-lime-ton.vercel.app';

const manifest = {
  url: baseUrl.replace(/\/$/, ''),
  name: 'DOM Mobile',
  iconUrl: `${baseUrl.replace(/\/$/, '')}/favicon.ico`,
  termsOfUseUrl: baseUrl.replace(/\/$/, ''),
  privacyPolicyUrl: baseUrl.replace(/\/$/, ''),
};

const distPath = path.join(__dirname, '..', 'dist', 'tonconnect-manifest.json');
fs.mkdirSync(path.dirname(distPath), { recursive: true });
fs.writeFileSync(distPath, JSON.stringify(manifest, null, 2));
console.log('tonconnect-manifest.json written to', distPath);
