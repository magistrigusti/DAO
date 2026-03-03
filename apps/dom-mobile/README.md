# DOM Mobile — React Native + Web (Vercel)

Приложение для управления экосистемой DOM: деплой, минт, мониторинг, база активов.

## Запуск

```bash
# Мобильное (Expo)
npm start

# Web
npm run web

# Сборка для Vercel
npm run build:web
```

## Деплой на Vercel

1. Подключи репозиторий к Vercel.
2. **Root Directory**: `apps/dom-mobile`
3. **Build Command**: `npx expo export --platform web`
4. **Output Directory**: `dist`
5. **Environment**: `MONGODB_URI` — connection string MongoDB Atlas

## API (MongoDB)

- `GET /api/assets` — список крипто-активов (jetton, NFT)
- `POST /api/assets` — добавить актив
- `GET /api/contracts` — адреса контрактов
- `POST /api/contracts` — сохранить адреса

## Мобильное приложение

В Settings укажи **API URL** — адрес задеплоенного приложения (например `https://dom-mobile.vercel.app`), чтобы приложение с телефона обращалось к API.
