# Дорожная карта развития «Проект Горизонт»
## Версия 2.0 — Живой мир + Монетизация

---

## 1. Бизнес-модель

### Freemium
```
┌─────────────────────────────────────────────────────────┐
│  БЕСПЛАТНО                                              │
│  ├── Игры до 4 человек                                  │
│  ├── Базовый сценарий                                   │
│  └── Без истории/аналитики                              │
├─────────────────────────────────────────────────────────┤
│  ПЛАТНО (разовая покупка или подписка)                  │
│  ├── Игры 5-20 человек                                  │
│  ├── История всех игр                                   │
│  ├── Аналитика и отчёты                                 │
│  ├── Система прогрессии персонажей                      │
│  ├── Дополнительные сценарии                            │
│  └── Приоритетная поддержка                             │
└─────────────────────────────────────────────────────────┘
```

### Пользователи системы

| Роль | Описание | Авторизация |
|------|----------|-------------|
| **Гость** | Может играть по QR/ссылке | Нет |
| **Фасилитатор** | Создаёт и ведёт игры | Логин + пароль |
| **Админ** | Управляет фасилитаторами, видит всё | Логин + пароль |

---

## 2. Система прогрессии персонажей

### Характеристики (для будущего)

```
┌─────────────────────────────────────────────────────────┐
│  БАЗОВЫЕ ХАРАКТЕРИСТИКИ                                 │
│  ├── 💪 Сила — физические задачи, защита                │
│  ├── 🏃 Ловкость — скорость, скрытность                 │
│  ├── 🗣️ Переговоры — убеждение, торговля               │
│  ├── 🧠 Интеллект — решение загадок, знания             │
│  ├── ❤️ Харизма — лидерство, доверие                   │
│  └── 🔧 Мастерство — крафт, ремонт                      │
├─────────────────────────────────────────────────────────┤
│  ПРОГРЕССИЯ                                             │
│  ├── Начальные очки: зависят от роли                    │
│  ├── Очки за игру: +1-3 за отыгрыш роли                 │
│  ├── Очки за достижения: особые действия                │
│  └── Сохранение между играми (если авторизован)         │
├─────────────────────────────────────────────────────────┤
│  ВЛИЯНИЕ НА ИГРУ                                        │
│  ├── Бонусы к действиям (вклад ресурсов × модификатор)  │
│  ├── Уникальные способности                             │
│  ├── Скрытые опции в дилеммах                           │
│  └── Влияние на случайные события                       │
└─────────────────────────────────────────────────────────┘
```

### Настройка фасилитатором

В меню создания игры:
- [ ] Включить систему прогрессии (платная опция)
- [ ] Начальные очки: Стандартные / Равные / Случайные
- [ ] Прогрессия за игру: Вкл / Выкл
- [ ] Оценка отыгрыша: Автоматическая / Ручная

---

## 3. Архитектура

### Целевая архитектура

```
┌─────────────────────────────────────────────────────────┐
│                         NGINX                           │
│                    (reverse proxy)                      │
└─────────────────────────┬───────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │  Frontend  │  │  Backend   │  │  Backend   │
   │  (React)   │  │  (Node.js) │  │  (Node.js) │
   │  :80/443   │  │  :3001     │  │  :3002     │
   └────────────┘  └─────┬──────┘  └─────┬──────┘
                         │               │
                         └───────┬───────┘
                                 ▼
                    ┌────────────────────────┐
                    │      PostgreSQL        │
                    │        :5432           │
                    └────────────────────────┘
                                 │
                    ┌────────────────────────┐
                    │        Redis           │
                    │        :6379           │
                    └────────────────────────┘
```

### Docker Compose

```yaml
# docker-compose.yml (целевой)
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: horizon
      POSTGRES_USER: horizon
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  backend:
    build: ./server
    environment:
      DATABASE_URL: postgresql://horizon:${DB_PASSWORD}@postgres:5432/horizon
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./client
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - frontend
      - backend

volumes:
  postgres_data:
  redis_data:
```

---

## 4. Схема базы данных

```sql
-- Фасилитаторы (пользователи системы)
CREATE TABLE facilitators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(20) DEFAULT 'facilitator', -- 'facilitator', 'admin'
  subscription_type VARCHAR(20) DEFAULT 'free', -- 'free', 'pro', 'enterprise'
  subscription_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Игровые сессии
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id UUID REFERENCES facilitators(id),
  code VARCHAR(8) UNIQUE NOT NULL,
  name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'setup', -- 'setup', 'active', 'paused', 'finished'
  player_count INT NOT NULL,
  settings JSONB DEFAULT '{}',
  state JSONB DEFAULT '{}',
  progression_enabled BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Участники сессий
CREATE TABLE session_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  role_id INT NOT NULL,
  player_name VARCHAR(255),
  token VARCHAR(16) UNIQUE NOT NULL,
  stats JSONB DEFAULT '{"strength":5,"agility":5,"negotiation":5,"intellect":5,"charisma":5,"craft":5}',
  experience_gained INT DEFAULT 0,
  is_connected BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP,
  last_seen_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Лог действий
CREATE TABLE action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES session_players(id) ON DELETE SET NULL,
  actor_type VARCHAR(20) NOT NULL, -- 'player', 'facilitator', 'system'
  action_type VARCHAR(50) NOT NULL,
  action_data JSONB DEFAULT '{}',
  game_context JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Прогресс персонажей (между играми)
CREATE TABLE character_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id UUID REFERENCES facilitators(id),
  player_identifier VARCHAR(255), -- email или уникальный ID игрока
  role_id INT NOT NULL,
  total_games INT DEFAULT 0,
  total_experience INT DEFAULT 0,
  stats JSONB DEFAULT '{}',
  achievements JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(facilitator_id, player_identifier, role_id)
);

-- Индексы
CREATE INDEX idx_sessions_facilitator ON game_sessions(facilitator_id);
CREATE INDEX idx_sessions_status ON game_sessions(status);
CREATE INDEX idx_sessions_code ON game_sessions(code);
CREATE INDEX idx_players_session ON session_players(session_id);
CREATE INDEX idx_players_token ON session_players(token);
CREATE INDEX idx_logs_session ON action_logs(session_id);
CREATE INDEX idx_logs_created ON action_logs(created_at);
```

---

## 5. Фазы разработки (обновлённые)

### Фаза 1: Авторизация + PostgreSQL (2 недели)
**Цель:** Фасилитаторы входят через логин/пароль, данные в PostgreSQL

**Задачи:**
- [ ] Docker Compose с PostgreSQL
- [ ] Prisma ORM + миграции
- [ ] Регистрация/вход фасилитатора (JWT)
- [ ] Личный кабинет фасилитатора
- [ ] Список своих игр
- [ ] Ограничение: >4 игроков требует подписку (заглушка)

**Результат:** Фасилитатор входит, видит свои игры

### Фаза 2: Мультисессионность (1-2 недели)
**Цель:** Несколько игр одновременно

**Задачи:**
- [ ] Создание сессии с уникальным кодом
- [ ] Изоляция WebSocket комнат
- [ ] QR-коды привязаны к сессии
- [ ] Переключение между сессиями в ЛК

**Результат:** Фасилитатор может вести несколько игр

### Фаза 3: Логирование + История (1-2 недели)
**Цель:** Всё записывается, всё можно посмотреть

**Задачи:**
- [ ] Middleware логирования socket-событий
- [ ] Просмотр истории сессии
- [ ] Replay ключевых моментов
- [ ] Экспорт в PDF/Excel

**Результат:** Полная история каждой игры

### Фаза 4: Динамическая карта (2-3 недели)
**Цель:** Карта живёт

**Задачи:**
- [ ] SVG-карта города
- [ ] Состояния зон (визуально)
- [ ] Анимации событий
- [ ] Режим проектора

**Результат:** Красивая живая карта

### Фаза 5: Система прогрессии (2-3 недели)
**Цель:** Персонажи развиваются

**Задачи:**
- [ ] Характеристики персонажей
- [ ] Влияние на механики
- [ ] Сохранение между играми
- [ ] UI для просмотра прогресса

**Результат:** RPG-элементы в игре

### Фаза 6: Платежи + Подписки (2 недели)
**Цель:** Монетизация

**Задачи:**
- [ ] Интеграция платёжной системы
- [ ] Управление подписками
- [ ] Ограничения по тарифам
- [ ] Админ-панель

**Результат:** Можно зарабатывать

---

## 6. Приоритеты (обновлённые)

```
КРИТИЧНО (делаем сейчас)
├── Фаза 1: Авторизация + PostgreSQL
└── Фаза 2: Мультисессионность

ВЫСОКИЙ ПРИОРИТЕТ
├── Фаза 3: Логирование
└── Фаза 4: Динамическая карта

СРЕДНИЙ ПРИОРИТЕТ
├── Фаза 5: Система прогрессии
└── Фаза 6: Платежи

НИЗКИЙ ПРИОРИТЕТ (позже)
├── Ветвящийся сценарий
├── Редактор сценариев
└── Мобильное приложение
```

---

## 7. Инфраструктура

### Сервер
- **Хостинг:** Собственный сервер
- **Контейнеры:** Docker + Docker Compose
- **База данных:** PostgreSQL (в контейнере)
- **Кэш:** Redis (в контейнере)

### Деплой
После каждой фазы:
1. `git pull` на сервере
2. `docker-compose build`
3. `docker-compose up -d`
4. Проверить логи: `docker-compose logs -f`

---

## 8. Начинаем: Фаза 1

### Шаг 1: Docker + PostgreSQL
Добавляем docker-compose.yml с PostgreSQL

### Шаг 2: Prisma
Устанавливаем Prisma, создаём схему

### Шаг 3: Авторизация
JWT токены, регистрация, вход

### Шаг 4: Личный кабинет
Страница фасилитатора со списком игр

### Шаг 5: Рефакторинг игры
Привязка сессии к фасилитатору

---

*Документ обновлён на основе обсуждения*
*Статус: Готов к реализации Фазы 1*
