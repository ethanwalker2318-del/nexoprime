# NEXO Backend

Node.js + TypeScript + Prisma (PostgreSQL) + Grammy

---

## Структура проекта

```
backend/
├── prisma/
│   ├── schema.prisma       # Схема БД
│   └── seed.ts             # Начальное заполнение (SUPER_ADMIN + CLOSER)
├── src/
│   ├── bot/
│   │   └── relay.ts        # Grammy бот — Relay система + Deep Linking
│   ├── controllers/
│   │   ├── userController.ts
│   │   └── kycController.ts
│   ├── lib/
│   │   └── prisma.ts       # Singleton Prisma Client
│   ├── middleware/
│   │   └── auth.ts         # Валидация Telegram initData + findOrCreate User
│   ├── routes/
│   │   └── index.ts        # Express роутер
│   ├── services/
│   │   ├── userService.ts
│   │   ├── balanceService.ts
│   │   └── kycService.ts
│   └── index.ts            # Точка входа
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Быстрый старт

```bash
# 1. Установить зависимости
npm install

# 2. Скопировать и заполнить .env
cp .env.example .env
# Вставить DATABASE_URL, BOT_TOKEN, SUPER_ADMIN_TG_ID

# 3. Применить миграции
npm run prisma:migrate:dev

# 4. Seed — создать SUPER_ADMIN и тестового CLOSER
npm run seed

# 5. Запустить в dev режиме
npm run dev
```

---

## Иерархия ролей

| Роль         | Описание |
|---|---|
| `SUPER_ADMIN` | Полный доступ ко всем сущностям. Нет invite_code. |
| `CLOSER`      | Видит только своих лидов. Имеет уникальный `invite_code`. |
| `USER (Lead)` | Привязывается к CLOSER через Deep Link. Если нет — к SUPER_ADMIN. |

---

## API эндпоинты

### Пользовательские (требуют `X-Telegram-Init-Data`)

| Метод | URL | Описание |
|---|---|---|
| `GET` | `/api/v1/user/profile` | Профиль, балансы, KYC, настройки |
| `POST` | `/api/v1/user/kyc` | Создать заявку на верификацию |
| `GET` | `/api/v1/user/kyc/history` | История KYC заявок |
| `GET` | `/api/v1/user/transactions` | История транзакций |

> Если `is_blocked === true` → `403 ACCESS_DENIED`  
> Если `trading_enabled === false` → поле в JSON заблокирует UI торговли

### Административные (требуют `X-Admin-Id`)

| Метод | URL | Описание |
|---|---|---|
| `PATCH` | `/api/v1/admin/users/:id/balance` | Обновить баланс (`symbol`, `delta`) |
| `PATCH` | `/api/v1/admin/users/:id/block` | Заблокировать (`blocked: bool`) |
| `PATCH` | `/api/v1/admin/users/:id/trading` | Вкл/выкл торговлю (`enabled: bool`) |
| `POST` | `/api/v1/admin/kyc/:requestId/review` | Одобрить/отклонить KYC |

> `updateBalance` доступен только SUPER_ADMIN **или** CLOSER, за которым закреплён пользователь.

---

## Relay-система (Grammy бот)

### Привязка лида (Deep Linking)
```
https://t.me/<BOT_USERNAME>?start=cl_<invite_code>
```
- Новый пользователь отправляет `/start cl_abc123`
- Бот находит CLOSER по `invite_code`
- Создаёт лида с `owner_id` = CLOSER
- CLOSER получает уведомление о новом лиде

### Relay чат
1. **USER** пишет любой текст в бот
2. Бот пересылает сообщение **CLOSER'у** с кнопкой «✉️ Ответить»
3. CLOSER нажимает «✉️ Ответить» → bot сохраняет `session.replyToUserId`
4. CLOSER пишет текст → бот отправляет его **USER'у** от имени бота
5. Все сообщения логируются в `SupportMessage`

---

## Схема БД (краткое описание)

```
Admin          — SUPER_ADMIN / CLOSER (invite_code)
User           — Лид, owner_id → Admin, is_blocked, trading_enabled, kyc_status
Asset          — Балансы (USDT, BTC, ETH ...) per user
BinaryTrade    — История сделок (forced_result: WIN/LOSS/AUTO)
Transaction    — Депозиты/Выводы (PENDING/SUCCESS/REJECTED)
KycRequest     — Заявки с document_url, selfie_url
SupportMessage — Relay лог (USER ↔ CLOSER)
```
