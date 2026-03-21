# Фаза 2: Мультисессионность

**Статус:** ✅ Завершено
**Даты:** 2026-03-21

---

## Цель

Обеспечить возможность ведения нескольких игр одновременно, каждая изолирована.

---

## Выполнено

- ✅ Игровое состояние хранится в PostgreSQL (`game_sessions.state`)
- ✅ WebSocket rooms изолированы по sessionCode (`session:{code}`)
- ✅ Per-session таймеры (`Map<sessionCode, NodeJS.Timeout>`)
- ✅ Все GameService методы переведены на async + sessionCode
- ✅ API `/api/init-session` для инициализации состояния игры
- ✅ Все клиентские страницы передают sessionCode между собой
- ✅ QR-коды содержат параметр `?session=CODE`

---

## Архитектура

```
Было:
  SQLite (один файл) → глобальное состояние
  io.emit() → broadcast всем
  Один глобальный таймер

Стало:
  PostgreSQL game_sessions.state → состояние per-session
  io.to('session:{code}').emit() → изоляция событий
  Map<sessionCode, timer> → таймер per-session
```

```
┌─────────────┐     ┌──────────────────────────────┐
│  Client A   │────▶│  WebSocket Room: session:ABC │
│  (Game 1)   │     │  State: PostgreSQL (ABC)     │
├─────────────┤     ├──────────────────────────────┤
│  Client B   │────▶│  WebSocket Room: session:XYZ │
│  (Game 2)   │     │  State: PostgreSQL (XYZ)     │
└─────────────┘     └──────────────────────────────┘
```

---

## Затронутые файлы

**Server:**
- `prisma-game-state-repository.ts` — НОВЫЙ: репозиторий для PostgreSQL
- `game-service.ts` — все 50+ методов теперь async с sessionCode
- `socket-handler.ts` — session rooms, per-session timers
- `api-routes.ts` — все endpoints принимают `?session=CODE`

**Client:**
- `useSocket.ts` — auto-join session
- `useGameState.ts` — sessionCode awareness
- Все страницы — передача sessionCode

---

## Breaking Changes

- ⚠️ SQLite больше не используется для игрового состояния
- ⚠️ Все API endpoints требуют параметр `?session=CODE`
- ⚠️ GameService методы теперь async (возвращают Promise)
