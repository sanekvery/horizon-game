import type { GameState } from '../entities/game-state.js';

export interface GameStateRepository {
  findBySessionId(sessionId: string): GameState | null;
  save(state: GameState): void;
  getCurrentSession(): GameState | null;
  createSession(sessionId: string): GameState;
}
