import type { GameState } from '../entities/game-state.js';

/**
 * @deprecated Use SessionAwareGameStateRepository instead
 */
export interface GameStateRepository {
  findBySessionId(sessionId: string): GameState | null;
  save(state: GameState): void;
  getCurrentSession(): GameState | null;
  createSession(sessionId: string): GameState;
}

/**
 * Session-aware repository for multi-session support
 * Uses PostgreSQL game_sessions.state for storage
 */
export interface SessionAwareGameStateRepository {
  /**
   * Get game state for a specific session by code
   */
  getSessionState(sessionCode: string): Promise<GameState | null>;

  /**
   * Save game state for a specific session
   */
  saveSessionState(sessionCode: string, state: GameState): Promise<void>;

  /**
   * Initialize a new session with default game state
   * Returns the created state or null if session doesn't exist
   */
  initializeSession(sessionCode: string, playerCount: number): Promise<GameState | null>;

  /**
   * Delete game state for a session (clear the state field)
   */
  clearSessionState(sessionCode: string): Promise<void>;

  /**
   * Check if a session exists and has initialized state
   */
  hasSessionState(sessionCode: string): Promise<boolean>;
}
