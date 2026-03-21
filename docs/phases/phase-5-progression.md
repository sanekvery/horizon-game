# Фаза 5: Система прогрессии персонажей

**Статус:** ✅ Базовая реализация завершена
**Даты:** 2026-03-21

---

## Цель

Добавить RPG-элементы: характеристики персонажей влияют на игровые механики, прогресс сохраняется между играми.

---

## Выполнено

### Server
- ✅ `character-stats.ts` — Value Object для характеристик (6 статов)
- ✅ `experience.ts` — Value Object для XP с формулами уровней
- ✅ `progression-calculator.ts` — Расчёт бонусов на основе статов
- ✅ `progression-service.ts` — Application service для управления прогрессией
- ✅ `progression-routes.ts` — API endpoints для прогрессии
- ✅ `socket-handler.ts` — Интеграция XP за действия (ресурсы, голосование, апгрейд, завершение игры)
- ✅ `game-service.ts` — Поддержка бонусов при внесении ресурсов (craft stat)

### Client
- ✅ `StatsDisplay.tsx` — Компонент отображения характеристик
- ✅ `ExperienceBar.tsx` — Прогресс-бар опыта с анимациями
- ✅ `StatsEditor.tsx` — Редактор распределения очков
- ✅ `progression-api.ts` — API клиент для прогрессии
- ✅ `useProgression.ts` — React хук для работы с прогрессией
- ✅ `MobilePlayer.tsx` — Интеграция отображения статов и XP

---

## Текущее состояние БД

В Prisma-схеме уже заложены структуры:

```prisma
// SessionPlayer — статы конкретной сессии
model SessionPlayer {
  stats             Json  @default("{\"strength\":5,\"agility\":5,\"negotiation\":5,\"intellect\":5,\"charisma\":5,\"craft\":5}")
  experienceGained  Int   @default(0)
}

// CharacterProgress — прогресс между играми
model CharacterProgress {
  playerIdentifier  String   // email или уникальный ID
  roleId            Int      // роль персонажа
  totalGames        Int
  totalExperience   Int
  stats             Json     // накопленные статы
  achievements      Json     // достижения
}

// GameSession
model GameSession {
  progressionEnabled  Boolean  @default(false)
}
```

---

## Характеристики персонажей

| Характеристика | Иконка | Описание | Влияние на игру |
|----------------|--------|----------|-----------------|
| **Сила** | 💪 | Физическая мощь | Защита зон, перенос тяжестей |
| **Ловкость** | 🏃 | Скорость, реакция | Скорость действий, уклонение от событий |
| **Переговоры** | 🗣️ | Убеждение, дипломатия | Бонусы при торговле ресурсами |
| **Интеллект** | 🧠 | Знания, аналитика | Бонусы при исследованиях |
| **Харизма** | ❤️ | Лидерство, доверие | Влияние на голосования |
| **Мастерство** | 🔧 | Крафт, ремонт | Эффективность улучшения зон |

### Диапазон значений

- Начальное значение: **5** (по умолчанию)
- Минимум: **1**
- Максимум: **10** (для новых игроков) / **15** (с прогрессией)

---

## Механики влияния

### 1. Внесение ресурсов в зоны

```typescript
// Эффективность вклада = amount * (1 + craft / 20)
// craft = 5: множитель 1.25
// craft = 10: множитель 1.5
const effectiveAmount = Math.floor(amount * (1 + stats.craft / 20));
```

### 2. Защита от негативных событий

```typescript
// Шанс уменьшить урон = strength * 5%
// strength = 5: 25% шанс
// strength = 10: 50% шанс
const mitigateChance = stats.strength * 0.05;
```

### 3. Торговля ресурсами (будущее)

```typescript
// Бонус при обмене = negotiation * 2%
// negotiation = 5: +10% к получаемому
// negotiation = 10: +20% к получаемому
const tradeBonus = 1 + stats.negotiation * 0.02;
```

### 4. Голосования

```typescript
// Вес голоса = 1 + (charisma - 5) * 0.1
// charisma = 5: вес 1.0
// charisma = 10: вес 1.5
const voteWeight = 1 + (stats.charisma - 5) * 0.1;
```

### 5. Исследование неизвестной зоны

```typescript
// Шанс найти бонус = intellect * 10%
// intellect = 5: 50% шанс
// intellect = 10: 100% шанс
const discoveryChance = Math.min(stats.intellect * 0.1, 1);
```

---

## Получение опыта (XP)

| Действие | XP | Примечание |
|----------|-----|------------|
| Внесение ресурсов | 5-20 | Зависит от количества |
| Участие в голосовании | 10 | Любой голос |
| Победа в голосовании | 25 | Выбранный вариант победил |
| Улучшение зоны | 50 | За каждый уровень |
| Выполнение обещания | 30 | Если обещание зачтено |
| Завершение игры | 100 | Бонус за полную игру |
| Победа команды | 200 | Все зоны >= уровень 3 |

### Формула уровня

```typescript
// Требуемый XP для уровня N = 100 * N * (N + 1) / 2
// Уровень 1: 100 XP
// Уровень 2: 300 XP (всего)
// Уровень 3: 600 XP (всего)
// Уровень 5: 1500 XP (всего)
// Уровень 10: 5500 XP (всего)

function calculateLevel(totalXP: number): number {
  let level = 0;
  let xpNeeded = 0;
  while (xpNeeded <= totalXP) {
    level++;
    xpNeeded += 100 * level;
  }
  return level - 1;
}
```

### Очки развития

При повышении уровня игрок получает **2 очка развития**.
- Можно потратить на любую характеристику
- Максимум +5 к базовому значению (5 + 5 = 10)
- С прогрессией максимум 15 (5 + 10)

---

## Архитектура

### Server-side

```
server/src/
├── domain/
│   ├── entities/
│   │   ├── character-stats.ts      # НОВЫЙ: Value Object для статов
│   │   └── experience.ts           # НОВЫЙ: Value Object для XP
│   └── services/
│       └── progression-calculator.ts  # НОВЫЙ: расчёт бонусов
│
├── application/
│   └── services/
│       └── progression-service.ts  # НОВЫЙ: управление прогрессией
│
└── infrastructure/
    └── database/
        └── progression-repository.ts  # НОВЫЙ: работа с CharacterProgress
```

### Client-side

```
client/src/
├── components/
│   └── progression/
│       ├── StatsDisplay.tsx        # Отображение характеристик
│       ├── StatsEditor.tsx         # Распределение очков
│       ├── ExperienceBar.tsx       # Прогресс-бар XP
│       └── AchievementBadge.tsx    # Значки достижений
│
├── pages/
│   └── PlayerProfile.tsx           # НОВЫЙ: профиль игрока с прогрессом
│
└── hooks/
    └── useProgression.ts           # Хук для работы с прогрессией
```

---

## API Endpoints

```
GET  /api/progression/:playerIdentifier
     Получить прогресс игрока

POST /api/progression/:playerIdentifier/stats
     Распределить очки развития
     Body: { statName: string, points: number }

GET  /api/sessions/:code/players/:roleId/stats
     Получить статы игрока в текущей сессии

POST /api/sessions/:code/players/:roleId/xp
     Начислить опыт (внутреннее использование)
```

---

## Socket Events

```typescript
// Начисление XP
'progression:xp-gained': {
  roleId: number;
  amount: number;
  reason: string;
  newTotal: number;
}

// Повышение уровня
'progression:level-up': {
  roleId: number;
  newLevel: number;
  availablePoints: number;
}

// Обновление статов
'progression:stats-updated': {
  roleId: number;
  stats: CharacterStats;
}
```

---

## UI Компоненты

### 1. StatsDisplay — карточка характеристик

```
┌─────────────────────────────────┐
│  👤 Инженер                     │
│  Уровень 3  ████████░░  340 XP  │
├─────────────────────────────────┤
│  💪 Сила        ████░░░░░░  4   │
│  🏃 Ловкость    █████░░░░░  5   │
│  🗣️ Переговоры  ██████░░░░  6   │
│  🧠 Интеллект   ████████░░  8   │
│  ❤️ Харизма     █████░░░░░  5   │
│  🔧 Мастерство  ███████░░░  7   │
└─────────────────────────────────┘
```

### 2. StatsEditor — распределение очков

```
┌─────────────────────────────────┐
│  🎉 Новый уровень!               │
│  Очки развития: 2               │
├─────────────────────────────────┤
│  💪 Сила        4  [+] [-]      │
│  🏃 Ловкость    5  [+] [-]      │
│  🗣️ Переговоры  6  [+] [-]      │
│  🧠 Интеллект   8  [+] [-]      │
│  ❤️ Харизма     5  [+] [-]      │
│  🔧 Мастерство  7  [+] [-]      │
├─────────────────────────────────┤
│        [Подтвердить]            │
└─────────────────────────────────┘
```

### 3. ExperienceBar — в PlayerPage

```
┌─────────────────────────────────────────────┐
│  Уровень 3   ████████████████░░░░  340/600  │
│              +25 XP за голосование          │
└─────────────────────────────────────────────┘
```

---

## Достижения (Achievements)

| ID | Название | Описание | Условие |
|----|----------|----------|---------|
| first_game | Первая игра | Завершить первую игру | Завершить игру |
| team_player | Командный игрок | Внести 50+ ресурсов за игру | resources >= 50 |
| diplomat | Дипломат | Выиграть 5 голосований | wins >= 5 |
| builder | Строитель | Улучшить 10 зон | upgrades >= 10 |
| veteran | Ветеран | Сыграть 10 игр | games >= 10 |
| master | Мастер | Достичь 10 уровня | level >= 10 |

---

## Порядок реализации

### Этап 1: Domain Layer ✅
- [x] Создать `CharacterStats` value object
- [x] Создать `Experience` value object с формулами
- [x] Создать `ProgressionCalculator` для расчёта бонусов

### Этап 2: Application Layer ✅
- [x] Создать `ProgressionService`
- [x] Интегрировать начисление XP в socket-handler
- [x] Добавить расчёт бонусов при действиях (craft → ресурсы)

### Этап 3: Infrastructure ✅
- [x] Использовать существующие таблицы (SessionPlayer, CharacterProgress)
- [x] Экспортировать prisma client для переиспользования

### Этап 4: API ✅
- [x] Endpoints для прогрессии (`/api/progression/*`)
- [x] Socket events для XP (`progression:xp-gained`, `progression:level-up`)

### Этап 5: Client — отображение ✅
- [x] `StatsDisplay` компонент
- [x] `ExperienceBar` компонент
- [x] Интеграция в `MobilePlayer` (PlayerPage)

### Этап 6: Client — редактирование ✅
- [x] `StatsEditor` компонент
- [x] `progression-api.ts` клиент
- [x] `useProgression` хук
- [ ] `PlayerProfile` страница (отложено)
- [ ] UI для распределения очков (отложено)

### Этап 7: Интеграция ✅
- [x] Применение бонусов в игровых механиках (craft → ресурсы)
- [ ] Тестирование влияния статов
- [ ] Балансировка

---

## Тестирование

1. Начисление XP за каждое действие
2. Правильный расчёт уровня
3. Распределение очков развития
4. Применение бонусов в механиках
5. Сохранение прогресса между играми
6. Отображение статов в UI

---

## Что не входит (отложено)

- Классы персонажей (воин, маг, и т.д.)
- Навыки/способности
- Инвентарь
- Квесты

---

*План создан: 2026-03-21*
