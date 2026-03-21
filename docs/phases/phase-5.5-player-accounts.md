# Фаза 5.5: Аккаунты игроков и личный кабинет

**Статус:** 📋 Планирование
**Даты:** TBD
**Зависимости:** Фаза 5 (Прогрессия)

---

## Цель

Создать полноценную систему аккаунтов для игроков с сохранением прогресса между играми, личным кабинетом и историей участия.

**Ключевые решения (из обсуждения):**
- Авторизация: Email + пароль
- Прогрессия: Один общий профиль на все роли
- Монетизация: Подписка фасилитатора + покупка пакетов
- Join flow: QR/ссылка → авторизация

---

## Проблема

Текущее состояние:
```
Игрок → QR-код → получает токен → играет → сессия завершена → данные потеряны
                                                    ↓
                            CharacterProgress привязан к facilitatorId + строка
                            (нет настоящей идентификации игрока)
```

Целевое состояние:
```
Игрок → регистрация → профиль с историей → QR-код → авторизация → играет
                ↓                                        ↓
        личный кабинет                           статы из профиля
        история игр                              после игры → XP в профиль
        достижения
```

---

## Архитектура

### Ролевая модель

```
┌─────────────────────────────────────────────────────────────────┐
│                         User (базовый)                          │
│  - id, email, passwordHash, emailVerified                       │
│  - createdAt, lastLoginAt                                       │
├─────────────────────────────────────────────────────────────────┤
│                              │                                  │
│              ┌───────────────┴───────────────┐                  │
│              ▼                               ▼                  │
│    ┌─────────────────┐            ┌─────────────────────┐       │
│    │  PlayerProfile  │            │ FacilitatorProfile  │       │
│    ├─────────────────┤            ├─────────────────────┤       │
│    │ userId (1:1)    │            │ userId (1:1)        │       │
│    │ displayName     │            │ organizationName    │       │
│    │ avatar          │            │ subscriptionTier    │       │
│    │ totalXP         │            │ maxPlayersPerGame   │       │
│    │ level           │            │ maxActiveSessions   │       │
│    │ stats (JSON)    │            │ customScenarios     │       │
│    │ availablePoints │            └─────────────────────┘       │
│    │ achievements    │                                          │
│    └─────────────────┘                                          │
│              │                                                  │
│              ▼                                                  │
│    ┌─────────────────┐                                          │
│    │   GameHistory   │                                          │
│    ├─────────────────┤                                          │
│    │ playerId        │                                          │
│    │ sessionId       │                                          │
│    │ roleId          │                                          │
│    │ xpEarned        │                                          │
│    │ playedAt        │                                          │
│    │ stats (снапшот) │                                          │
│    │ achievements    │                                          │
│    └─────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Пользователь может быть и игроком, и фасилитатором

```typescript
// Один User может иметь оба профиля
User {
  playerProfile?: PlayerProfile   // Если играет в игры
  facilitatorProfile?: FacilitatorProfile  // Если проводит игры
}
```

---

## Схема БД (Prisma)

```prisma
// === ПОЛЬЗОВАТЕЛИ ===

model User {
  id              String    @id @default(uuid())
  email           String    @unique
  passwordHash    String
  emailVerified   Boolean   @default(false)
  verifyToken     String?
  resetToken      String?
  resetTokenExp   DateTime?

  createdAt       DateTime  @default(now())
  lastLoginAt     DateTime?

  // Профили (оба опциональные)
  playerProfile       PlayerProfile?
  facilitatorProfile  FacilitatorProfile?

  // Сессии авторизации
  sessions        AuthSession[]
}

model AuthSession {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token       String   @unique
  userAgent   String?
  ipAddress   String?
  expiresAt   DateTime
  createdAt   DateTime @default(now())
}

// === ПРОФИЛЬ ИГРОКА ===

model PlayerProfile {
  id              String   @id @default(uuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  displayName     String
  avatar          String?  // URL или код аватара

  // Прогрессия (общая на все роли)
  totalXP         Int      @default(0)
  level           Int      @default(0)
  stats           Json     @default("{\"strength\":5,\"agility\":5,\"negotiation\":5,\"intellect\":5,\"charisma\":5,\"craft\":5}")
  availablePoints Int      @default(0)

  // Достижения
  achievements    Json     @default("[]")

  // Статистика
  totalGames      Int      @default(0)
  totalWins       Int      @default(0)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // История игр
  gameHistory     PlayerGameHistory[]

  // Связь с сессиями (когда игрок в активной игре)
  sessionPlayers  SessionPlayer[]
}

model PlayerGameHistory {
  id              String   @id @default(uuid())
  playerId        String
  player          PlayerProfile @relation(fields: [playerId], references: [id], onDelete: Cascade)

  sessionId       Int
  session         GameSession @relation(fields: [sessionId], references: [id])

  roleId          Int      // Какую роль играл
  roleName        String   // Название роли (для истории)

  xpEarned        Int      // Сколько XP заработал
  statsSnapshot   Json     // Статы на момент игры

  // Результат
  teamWon         Boolean
  personalScore   Int?     // Опционально: личный счёт

  playedAt        DateTime @default(now())
  duration        Int?     // Длительность в минутах

  // Достижения, полученные в этой игре
  achievementsUnlocked Json @default("[]")

  @@index([playerId])
  @@index([sessionId])
}

// === ПРОФИЛЬ ФАСИЛИТАТОРА ===

model FacilitatorProfile {
  id                  String   @id @default(uuid())
  userId              String   @unique
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  organizationName    String?

  // Подписка
  subscriptionTier    SubscriptionTier @default(FREE)
  subscriptionEndsAt  DateTime?

  // Лимиты (зависят от подписки)
  maxPlayersPerGame   Int      @default(8)
  maxActiveSessions   Int      @default(1)
  maxHistorySessions  Int      @default(5)
  customScenariosAllowed Boolean @default(false)

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  // Связь с сессиями
  sessions            GameSession[]

  // Покупки
  purchases           Purchase[]
}

enum SubscriptionTier {
  FREE        // 8 игроков, 1 сессия, 5 в истории
  BASIC       // 12 игроков, 3 сессии, 20 в истории
  PRO         // 20 игроков, 10 сессий, безлимит история
  ENTERPRISE  // Кастомные лимиты
}

model Purchase {
  id              String   @id @default(uuid())
  facilitatorId   String
  facilitator     FacilitatorProfile @relation(fields: [facilitatorId], references: [id])

  type            PurchaseType
  amount          Int      // Сумма в копейках
  currency        String   @default("RUB")

  // Что купили
  details         Json     // { "tier": "PRO", "months": 3 } или { "extraPlayers": 4 }

  status          PurchaseStatus @default(PENDING)
  paymentId       String?  // ID от платёжной системы

  createdAt       DateTime @default(now())
  completedAt     DateTime?
}

enum PurchaseType {
  SUBSCRIPTION
  EXTRA_PLAYERS
  EXTRA_SESSIONS
  CUSTOM_SCENARIO
}

enum PurchaseStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

// === ОБНОВЛЕНИЕ СУЩЕСТВУЮЩИХ МОДЕЛЕЙ ===

model SessionPlayer {
  // ... существующие поля ...

  // НОВОЕ: связь с профилем игрока (опционально для гостей)
  playerProfileId String?
  playerProfile   PlayerProfile? @relation(fields: [playerProfileId], references: [id])
}

model GameSession {
  // ... существующие поля ...

  // НОВОЕ: связь с профилем фасилитатора
  facilitatorProfileId String?
  facilitatorProfile   FacilitatorProfile? @relation(fields: [facilitatorProfileId], references: [id])

  // История игр для связи
  playerHistories      PlayerGameHistory[]
}
```

---

## Подписки фасилитаторов

| Тариф | Цена/мес | Игроков | Сессий | История | Кастом сценарии |
|-------|----------|---------|--------|---------|-----------------|
| **FREE** | 0 ₽ | 8 | 1 | 5 игр | ❌ |
| **BASIC** | 990 ₽ | 12 | 3 | 20 игр | ❌ |
| **PRO** | 2490 ₽ | 20 | 10 | ∞ | ✅ |
| **ENTERPRISE** | по запросу | кастом | кастом | ∞ | ✅ |

### Дополнительные покупки

- +4 игрока к сессии: 290 ₽ (разово)
- +2 активных сессии: 490 ₽/мес
- Кастомный сценарий: 1990 ₽ (разово)

---

## Флоу авторизации

### Регистрация

```
1. Пользователь вводит email + пароль
2. Создаётся User + PlayerProfile (по умолчанию)
3. Отправляется письмо для верификации
4. После верификации — полный доступ
```

### Вход

```
1. Email + пароль → проверка
2. Создаётся AuthSession с JWT токеном
3. Токен хранится в httpOnly cookie + localStorage (для mobile)
```

### Подключение к игре (QR/ссылка)

```
1. Игрок сканирует QR → /join/:sessionCode
2. Проверяем авторизацию:
   - Авторизован? → Выбор роли, подтягиваем статы
   - Не авторизован? → Предложение войти/зарегистрироваться
3. При выборе роли:
   - Привязываем SessionPlayer к PlayerProfile
   - Загружаем статы из профиля в сессию
4. После игры:
   - Переносим XP в профиль
   - Создаём запись в GameHistory
```

### Гостевой режим (опционально)

```
Можно играть без регистрации:
- Вводишь только имя
- Статы дефолтные
- Прогресс не сохраняется
- После игры — предложение зарегистрироваться и сохранить результат
```

---

## API Endpoints

### Авторизация

```
POST /api/auth/register
     Body: { email, password, displayName }
     → { success, message: "Проверьте email" }

POST /api/auth/login
     Body: { email, password }
     → { success, token, user: { id, email, playerProfile, facilitatorProfile } }

POST /api/auth/logout
     → { success }

GET  /api/auth/me
     → { user: {...}, playerProfile: {...}, facilitatorProfile: {...} }

POST /api/auth/verify-email/:token
     → { success }

POST /api/auth/forgot-password
     Body: { email }
     → { success }

POST /api/auth/reset-password/:token
     Body: { password }
     → { success }
```

### Профиль игрока

```
GET  /api/player/profile
     → { profile: PlayerProfile, gameHistory: [...] }

PATCH /api/player/profile
     Body: { displayName?, avatar? }
     → { profile }

POST /api/player/allocate-points
     Body: { statName, points }
     → { newStats, remainingPoints }

GET  /api/player/history
     Query: ?page=1&limit=10
     → { games: [...], total, pages }

GET  /api/player/achievements
     → { unlocked: [...], available: [...] }
```

### Профиль фасилитатора

```
GET  /api/facilitator/profile
     → { profile, subscription, limits }

POST /api/facilitator/upgrade
     Body: { tier: "PRO" }
     → { paymentUrl } // Редирект на платёжку

GET  /api/facilitator/sessions
     → { active: [...], history: [...] }
```

### Подключение к игре

```
POST /api/session/:code/join
     Body: { roleId }
     Headers: Authorization: Bearer <token>
     → { success, token (для socket), role }

POST /api/session/:code/join-guest
     Body: { roleId, guestName }
     → { success, token (для socket), role }
```

---

## Личный кабинет игрока

### Страницы

1. **Dashboard** (`/profile`)
   - Аватар, имя, уровень
   - Быстрая статистика (игр, побед, XP)
   - Последние 3 игры
   - Кнопка "Присоединиться к игре"

2. **Прогрессия** (`/profile/progression`)
   - Уровень и XP бар
   - 6 характеристик с возможностью распределения очков
   - Описание влияния каждой характеристики

3. **История игр** (`/profile/history`)
   - Таблица с играми
   - Фильтры по дате, роли, результату
   - Детали каждой игры (статистика, события)

4. **Достижения** (`/profile/achievements`)
   - Полученные достижения с датами
   - Доступные (прогресс)
   - Редкие/скрытые

5. **Настройки** (`/profile/settings`)
   - Смена пароля
   - Email уведомления
   - Удаление аккаунта

---

## Диаграмма компонентов

```
client/src/
├── pages/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── ForgotPasswordPage.tsx
│   │   └── ResetPasswordPage.tsx
│   │
│   ├── profile/
│   │   ├── ProfileDashboard.tsx      # Главная кабинета
│   │   ├── ProgressionPage.tsx       # Статы и уровень
│   │   ├── GameHistoryPage.tsx       # История игр
│   │   ├── AchievementsPage.tsx      # Достижения
│   │   └── SettingsPage.tsx          # Настройки
│   │
│   └── JoinGamePage.tsx              # /join/:code с авторизацией
│
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── AuthGuard.tsx             # Защита роутов
│   │
│   └── profile/
│       ├── ProfileHeader.tsx
│       ├── StatsEditor.tsx           # (уже есть)
│       ├── GameHistoryTable.tsx
│       └── AchievementCard.tsx
│
├── hooks/
│   ├── useAuth.ts                    # Авторизация
│   ├── useProfile.ts                 # Профиль игрока
│   └── usePlayerStats.ts             # Статы из профиля
│
├── services/
│   ├── auth-api.ts                   # API авторизации
│   └── profile-api.ts                # API профиля
│
└── stores/
    └── authStore.ts                  # Zustand store для auth state
```

---

## Влияние на игровой процесс

### Бонусы от уровня

| Уровень | Бонус |
|---------|-------|
| 1-4 | Базовые статы |
| 5 | +1 к максимуму статов (11 вместо 10) |
| 10 | +1 слот достижения в игре |
| 15 | Уникальный визуал на карте |
| 20 | Доступ к продвинутым ролям |

### Достижения дают бонусы

| Достижение | Бонус |
|------------|-------|
| Первая игра | +5% XP |
| 10 игр | +10% XP |
| Командный игрок (50+ ресурсов) | +5% к craft |
| Дипломат (5 выигранных голосований) | +5% к charisma |

---

## Порядок реализации

### Этап 1: База данных и модели
- [ ] Миграция Prisma (User, PlayerProfile, FacilitatorProfile)
- [ ] Обновить SessionPlayer и GameSession
- [ ] Создать PlayerGameHistory

### Этап 2: Авторизация (Server)
- [ ] Регистрация с отправкой email
- [ ] Логин/логаут с JWT
- [ ] Middleware для защищённых роутов
- [ ] Восстановление пароля

### Этап 3: Авторизация (Client)
- [ ] Страницы логина/регистрации
- [ ] AuthGuard компонент
- [ ] AuthStore (Zustand)
- [ ] Интеграция с существующим UI

### Этап 4: Профиль игрока
- [ ] API для профиля
- [ ] Dashboard страница
- [ ] Прогрессия (перенос из StatsEditor)
- [ ] История игр

### Этап 5: Интеграция с игрой
- [ ] Обновить JoinGame flow
- [ ] Загрузка статов из профиля при входе
- [ ] Сохранение XP после игры
- [ ] Создание записи в истории

### Этап 6: Фасилитатор и подписки
- [ ] Профиль фасилитатора
- [ ] Управление подписками
- [ ] Интеграция с платёжной системой (ЮKassa/Stripe)

---

## Тестирование

1. Регистрация → верификация email → логин
2. Создание игры фасилитатором
3. Игрок сканирует QR → авторизация → выбор роли
4. Игра с применением статов из профиля
5. Завершение игры → XP в профиль → запись в истории
6. Проверка личного кабинета

---

## Миграция существующих данных

Для существующих CharacterProgress:
1. Создать "миграционного" пользователя
2. Перенести данные в PlayerProfile
3. Отправить email с приглашением зарегистрироваться
4. При регистрации по email — связать с существующим прогрессом

---

## Риски и решения

| Риск | Решение |
|------|---------|
| Пользователи не хотят регистрироваться | Гостевой режим + предложение сохранить после игры |
| Сложность интеграции с платежами | Начать с ручного подтверждения, автоматизировать позже |
| Email deliverability | Использовать Resend/SendGrid с правильной настройкой SPF/DKIM |

---

*План создан: 2026-03-21*
