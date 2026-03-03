// ========== СЕРВЕР МЕТАДАННЫХ DOM ==========
// Раздаёт dom-metadata.json и изображение токена.
// Запуск: npm start
// Деплой: Railway, Render, Fly.io или любой Node.js хостинг.
// ============================================

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// public/ из корня DAO (на уровень выше apps/)
const publicPath = path.resolve(__dirname, '../../public');

const app = express();
app.use(cors());

// Динамический dom-metadata.json с правильным base URL
app.get('/dom-metadata.json', (req, res) => {
  const protocol = req.protocol || 'https';
  const host = req.get('host') || `localhost:${process.env.PORT || 3333}`;
  const base = `${protocol}://${host}`;

  res.json({
    name: 'Dv1',
    symbol: 'DOM',
    decimals: '6',
    description:
      'Dominum v1 — токен DAO для сбора средств на остров. Острова, энергия астрала, дом для нейросетей.',
    image: `${base}/test_net_dom_img.jpg`,
  });
});

app.use(express.static(publicPath));

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
  console.log(`DOM Metadata server: http://localhost:${PORT}`);
  console.log(`  dom-metadata.json: http://localhost:${PORT}/dom-metadata.json`);
  console.log(`  Image: http://localhost:${PORT}/test_net_dom_img.jpg`);
});
