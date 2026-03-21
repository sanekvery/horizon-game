# Фаза 3: Логирование + История

**Статус:** ✅ Завершено
**Даты:** 2026-03-21

---

## Цель

Записывать все действия в игре и предоставить возможность просмотра истории.

---

## Выполнено

- ✅ LoggingService для записи всех действий в PostgreSQL (`action_logs`)
- ✅ Логирование 10 приоритетных socket-событий (MVP)
- ✅ API endpoints для получения истории и статистики сессий
- ✅ Страница `/session/:code/history` с таймлайном действий
- ✅ Фильтрация по типу актора (Игрок/Фасилитатор/Система)
- ✅ Статистика сессии (количество действий, длительность, топ действий)
- ✅ Кнопка "История" в личном кабинете

---

## Логируемые события

| Тип | События |
|-----|---------|
| **Игрок** | `PLAYER_JOIN`, `PLAYER_DISCONNECT`, `ROLE_CLAIM`, `VOTE_CAST`, `RESOURCE_CONTRIBUTE` |
| **Фасилитатор** | `ACT_CHANGE`, `TIMER_START`, `TIMER_STOP`, `GAME_START`, `GAME_FINISH`, `EVENT_TRIGGER` |

---

## Затронутые файлы

**Server:**
- `logging-service.ts` — НОВЫЙ: сервис логирования действий
- `socket-handler.ts` — добавлено логирование 10 событий
- `session-routes.ts` — endpoints `/code/:code/history` и `/code/:code/stats`

**Client:**
- `session-api.ts` — методы `getHistory()` и `getStats()`
- `SessionHistoryPage.tsx` — НОВЫЙ: страница истории сессии
- `FacilitatorDashboard.tsx` — кнопка "История"
- `App.tsx` — роут `/session/:sessionCode/history`

---

## API Endpoints

```
GET /api/sessions/code/:code/history?limit=50&offset=0&actorType=PLAYER
GET /api/sessions/code/:code/stats
```

---

## Что не вошло (отложено)

- Replay ключевых моментов
- Экспорт в PDF/Excel
- Real-time обновление истории
