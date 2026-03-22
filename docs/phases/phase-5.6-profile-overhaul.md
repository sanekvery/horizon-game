# Фаза 5.6: Переработка личного кабинета игрока

**Дата:** 2026-03-22
**Статус:** Завершено

---

## Цель

Создать красивый, информативный личный кабинет игрока в RPG-стиле с:
- 10 характеристиками и понятными правилами их влияния
- 25 достижениями (включая редкие, эпические и легендарные)
- Историей игр
- Справочником по игре

---

## Что сделано

### 1. Система характеристик (10 статов)

Добавлены 4 новые характеристики:

| Название | EN | Влияние |
|----------|-----|---------|
| Удача | luck | Шанс крит. успеха (3%/уровень) |
| Выносливость | endurance | Сопротивление, +1 действие за 5 уровней |
| Лидерство | leadership | Бонус команде (+1% за 3 уровня) |
| Восприятие | perception | Обнаружение скрытого (8%/уровень) |

### 2. Система достижений (25 штук)

**Категории:**
- 🎮 Игровые (8)
- 📊 Прогрессия (6)
- 🤝 Социальные (5)
- 🏗️ Зоны (6)

**Редкость:**
- Обычные (серые)
- Редкие (синие с свечением)
- Эпические (фиолетовые с анимацией)
- Легендарные (золотые с частицами)

### 3. Новые страницы профиля

```
/profile
├── /profile              → Обзор персонажа (CharacterCard)
├── /profile/stats        → Характеристики + распределение очков
├── /profile/achievements → Достижения (полученные и доступные)
├── /profile/history      → История игр
└── /profile/rules        → Правила игры и справка
```

### 4. UI компоненты

| Компонент | Описание |
|-----------|----------|
| ProfileLayout | Layout с навигацией |
| ProfileNav | Sidebar (desktop) / Bottom bar (mobile) |
| CharacterCard | RPG-карточка с аватаром и уровнем |
| StatBar | Прогресс-бар характеристики с тултипом |
| AchievementBadge | Бейдж достижения с редкостью |
| GameHistoryCard | Карточка игры в истории |

### 5. Файлы данных

- `stats-config.json` — 10 характеристик с формулами
- `achievements.json` — 25 достижений
- `rules-content.json` — контент для справки

---

## Изменённые файлы

### Сервер
- `server/prisma/schema.prisma` — 10 статов в дефолтах
- `server/src/domain/entities/character-stats.ts` — 4 новых стата
- `server/src/domain/services/progression-calculator.ts` — формулы

### Клиент
- `client/src/App.tsx` — роуты профиля
- `client/src/components/auth/AuthGuard.tsx` — allocatePoints
- `client/src/components/progression/StatsDisplay.tsx` — 10 статов
- `client/src/components/progression/StatsEditor.tsx` — 10 статов
- `client/src/services/player-auth-api.ts` — типы
- `client/src/services/progression-api.ts` — типы
- `client/src/index.css` — анимации

### Новые файлы
- 7 компонентов в `client/src/components/profile/`
- 5 страниц в `client/src/pages/profile/`
- 3 JSON-файла в `client/src/data/`

---

## Формулы характеристик

| Стат | Формула | Пример |
|------|---------|--------|
| Сила | mitigateChance = strength × 5% | При 10: 50% снижения урона |
| Ловкость | speedBonus = 1 + (agility - 5) × 0.05 | При 10: +25% скорость |
| Переговоры | tradeBonus = negotiation × 2% | При 10: +20% торговля |
| Интеллект | discoveryChance = min(intellect × 10%, 100%) | При 10: 100% открытие |
| Харизма | voteWeight = 1 + (charisma - 5) × 0.1 | При 10: ×1.5 голос |
| Мастерство | resourceBonus = 1 + craft / 20 | При 10: +50% ресурсы |
| Удача | critChance = luck × 3% | При 10: 30% крит |
| Выносливость | resistance = endurance × 4% | При 10: 40% сопротивление |
| Лидерство | teamBonus = floor(leadership / 3) × 1% | При 9: +3% команде |
| Восприятие | detection = min(perception × 8%, 100%) | При 13: 100% + предупреждения |

---

## Тестирование

1. Зарегистрировать нового игрока → профиль с 10 статами по 5
2. Перейти на /profile → CharacterCard отображается
3. /profile/stats → все 10 статов видны
4. /profile/achievements → категории и достижения
5. /profile/rules → справка работает
6. Мобильная версия → нижняя навигация

---

## Связанные документы

- [Фаза 5.5: Аккаунты игроков](./phase-5.5-player-accounts.md)
- [Дорожная карта](../roadmap.md)
