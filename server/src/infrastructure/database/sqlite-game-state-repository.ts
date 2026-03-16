import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type { GameState, Role } from '../../domain/entities/game-state.js';
import type { GameStateRepository } from '../../domain/repositories/game-state-repository.js';
import { ROLE_NAMES } from '../../domain/entities/role-names.js';

export class SqliteGameStateRepository implements GameStateRepository {
  private readonly db: Database.Database;

  constructor(dbPath: string = 'game.db') {
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        session_id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS current_session (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        session_id TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES game_sessions(session_id)
      );
    `);
  }

  findBySessionId(sessionId: string): GameState | null {
    const row = this.db
      .prepare('SELECT state_json FROM game_sessions WHERE session_id = ?')
      .get(sessionId) as { state_json: string } | undefined;

    if (!row) return null;
    return JSON.parse(row.state_json) as GameState;
  }

  save(state: GameState): void {
    const stmt = this.db.prepare(`
      INSERT INTO game_sessions (session_id, state_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(session_id) DO UPDATE SET
        state_json = excluded.state_json,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(state.sessionId, JSON.stringify(state));

    const currentStmt = this.db.prepare(`
      INSERT INTO current_session (id, session_id)
      VALUES (1, ?)
      ON CONFLICT(id) DO UPDATE SET session_id = excluded.session_id
    `);
    currentStmt.run(state.sessionId);
  }

  getCurrentSession(): GameState | null {
    const row = this.db
      .prepare(`
        SELECT gs.state_json
        FROM current_session cs
        JOIN game_sessions gs ON gs.session_id = cs.session_id
        WHERE cs.id = 1
      `)
      .get() as { state_json: string } | undefined;

    if (!row) return null;
    return JSON.parse(row.state_json) as GameState;
  }

  createSession(sessionId: string): GameState {
    const roles: Role[] = ROLE_NAMES.map((name, index) => ({
      id: index + 1,
      token: nanoid(8),
      name,
      connected: false,
      secretRevealed: false,
      promise: null,
      resources: { energy: 0, materials: 0, food: 0, knowledge: 0 },
      isActive: true,
      claimedBy: null,
    }));

    const initialState: GameState = {
      sessionId,
      currentAct: 1,
      currentScene: 1,
      timer: {
        running: false,
        remainingSec: 0,
      },
      zones: {
        center: {
          level: 0,
          resources: { energy: 0, materials: 0, food: 0, knowledge: 0 },
        },
        residential: {
          level: 0,
          resources: { energy: 0, materials: 0, food: 0, knowledge: 0 },
        },
        industrial: {
          level: 0,
          resources: { energy: 0, materials: 0, food: 0, knowledge: 0 },
        },
        green: {
          level: 0,
          resources: { energy: 0, materials: 0, food: 0, knowledge: 0 },
        },
        unknown: {
          revealed: false,
        },
      },
      roles,
      votes: [],
      candlesLit: [],
      fogRevealed: false,
      promises: [],
      settings: {
        playerCount: 20,
        difficulty: 'normal',
        distributionMode: 'qr',
        gamePhase: 'setup',
      },
    };

    this.save(initialState);
    return initialState;
  }

  close(): void {
    this.db.close();
  }
}
