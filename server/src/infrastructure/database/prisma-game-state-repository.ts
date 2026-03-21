import { PrismaClient, Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';
import type { GameState, Role } from '../../domain/entities/game-state.js';
import type { SessionAwareGameStateRepository } from '../../domain/repositories/game-state-repository.js';
import { ROLE_NAMES } from '../../domain/entities/role-names.js';

const prisma = new PrismaClient();

/**
 * PostgreSQL-based game state repository for multi-session support.
 * Stores game state in the game_sessions.state JSON field.
 */
export class PrismaGameStateRepository implements SessionAwareGameStateRepository {
  /**
   * Get game state for a specific session by code
   */
  async getSessionState(sessionCode: string): Promise<GameState | null> {
    const session = await prisma.gameSession.findUnique({
      where: { code: sessionCode },
    });

    if (!session) {
      return null;
    }

    const state = session.state as unknown;

    // Check if state is empty object or not initialized
    if (!state || typeof state !== 'object' || !('sessionId' in (state as Record<string, unknown>))) {
      return null;
    }

    return state as GameState;
  }

  /**
   * Save game state for a specific session
   */
  async saveSessionState(sessionCode: string, state: GameState): Promise<void> {
    await prisma.gameSession.update({
      where: { code: sessionCode },
      data: {
        state: state as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Initialize a new session with default game state
   */
  async initializeSession(sessionCode: string, playerCount: number): Promise<GameState | null> {
    const session = await prisma.gameSession.findUnique({
      where: { code: sessionCode },
    });

    if (!session) {
      return null;
    }

    // Check if already initialized
    const existingState = session.state as unknown;
    if (existingState && typeof existingState === 'object' && 'sessionId' in (existingState as Record<string, unknown>)) {
      return existingState as GameState;
    }

    const roles: Role[] = ROLE_NAMES.map((name, index) => ({
      id: index + 1,
      token: nanoid(8),
      name,
      connected: false,
      secretRevealed: false,
      promise: null,
      resources: { energy: 0, materials: 0, food: 0, knowledge: 0 },
      isActive: index < playerCount, // Only first N roles are active
      claimedBy: null,
    }));

    const initialState: GameState = {
      sessionId: session.id,
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
        playerCount,
        difficulty: 'normal',
        distributionMode: 'qr',
        gamePhase: 'setup',
        eventSettings: {
          enabled: false,
          probability: 30,
          enabledEventIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
        },
      },
      activeEvent: null,
      triggeredEvents: [],
    };

    await this.saveSessionState(sessionCode, initialState);
    return initialState;
  }

  /**
   * Clear game state for a session
   */
  async clearSessionState(sessionCode: string): Promise<void> {
    await prisma.gameSession.update({
      where: { code: sessionCode },
      data: {
        state: {},
      },
    });
  }

  /**
   * Check if a session exists and has initialized state
   */
  async hasSessionState(sessionCode: string): Promise<boolean> {
    const state = await this.getSessionState(sessionCode);
    return state !== null;
  }
}

// Singleton instance
export const prismaGameStateRepository = new PrismaGameStateRepository();
