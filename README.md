# TOILET GRADER

Браузерная игра: регистрация, гемы, 6 кейсов, инвентарь, апгрейдер, Color Dice, батлы (WebSocket), магазин, вывод, лидерборд, админ-панель.
Стек: Node.js 22 + TypeScript, React, встроенный SQLite (`node:sqlite`), `ws`. Все расчёты — только на сервере.

## Структура
- `server/` — сервер: `index.ts` (HTTP), `api.ts` (маршруты + админка), `auth.ts`, `core.ts` (гемы, ГСЧ), `games.ts` (кейсы, апгрейдер, dice, магазин), `battles.ts`, `withdraw.ts`, `ws.ts`, `art.ts` (SVG-иллюстрации), `catalog.ts` (48 юнитов, кейсы), `db.ts`
- `src/` — клиент (React + TS): `Shell.tsx`, `store.tsx`, `pages/*`, `ui/*`
- `public/` — `index.html`, `styles.css`, `app.js` (собирается)
- `scripts/` — `build.mjs`, `create-admin.ts`

## Запуск
```
npm install
npm run create-admin     # создать администратора Artyom_Topchik29 (спросит пароль)
npm start                # сборка клиента + сервер на http://localhost:3000
```
Переменные: `PORT`, `DATA_DIR` (по умолчанию `./data`), `COOKIE_SECURE=1` (за HTTPS), `TRUST_PROXY=1` (за nginx), `ADMIN_NICK`.

## База данных
Создаётся автоматически: файл `data/toilet-grader.db` (SQLite). Настройка не нужна. Резервная копия — копирование папки `data/`.
(PostgreSQL не используется: для одного сервера SQLite надёжнее и проще.)

## Администратор
Права выдаются только командой `npm run create-admin` на сервере (запись в БД). Проверка — по базе, не по нику.
Ник `Artyom_Topchik29` зарезервирован: занять его регистрацией нельзя. Повторный запуск команды меняет пароль.

## Вывод
Игрок: Инвентарь → «Вывод» → юнит или гемы + ник. Предмет списывается сразу. Админ → вкладка «Выводы»: видит заявки, дату и окно 15:00–17:00 (МСК), жмёт «Выдано» или «Отклонить» (предмет вернётся).

## Публикация в интернете
1. VPS с Node.js 22+, склонировать проект, `npm install`, `npm run create-admin`.
2. Запуск постоянно: `pm2 start "npm start" --name toilet-grader` (или systemd), env: `PORT=3000 COOKIE_SECURE=1 TRUST_PROXY=1`.
3. nginx + HTTPS (certbot), проксировать `/` на `127.0.0.1:3000` с заголовками для WebSocket:
   `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr;`
4. Либо Render/Railway/Fly.io: команда запуска `npm start`, подключить постоянный диск и указать `DATA_DIR` на него.
