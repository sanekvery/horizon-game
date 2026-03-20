import { PrismaClient, GameSession, SessionStatus, SubscriptionType } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

export interface CreateSessionInput {
  facilitatorId: string;
  name?: string;
  playerCount: number;
}

export interface SessionSummary {
  id: string;
  code: string;
  name: string | null;
  status: SessionStatus;
  playerCount: number;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface CreateSessionResult {
  success: boolean;
  error?: string;
  session?: SessionSummary;
}

export class SessionService {
  /**
   * Create a new game session for a facilitator
   */
  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    try {
      // Validate facilitator exists and check subscription
      const facilitator = await prisma.facilitator.findUnique({
        where: { id: input.facilitatorId },
      });

      if (!facilitator) {
        return { success: false, error: 'Фасилитатор не найден' };
      }

      // Check player count limits based on subscription
      if (!this.canCreateGameWithPlayers(facilitator.subscriptionType, input.playerCount)) {
        return {
          success: false,
          error: `Для игр более чем на 4 игрока требуется подписка Pro. Ваш тариф: ${facilitator.subscriptionType}`,
        };
      }

      // Generate unique session code (6 chars, uppercase)
      const code = await this.generateUniqueCode();

      // Create session in database
      const session = await prisma.gameSession.create({
        data: {
          facilitatorId: input.facilitatorId,
          code,
          name: input.name || `Игра ${code}`,
          status: 'SETUP',
          playerCount: input.playerCount,
          settings: {},
          state: {},
        },
      });

      return {
        success: true,
        session: this.toSummary(session),
      };
    } catch (error) {
      console.error('Create session error:', error);
      return { success: false, error: 'Ошибка создания сессии' };
    }
  }

  /**
   * Get all sessions for a facilitator
   */
  async getSessionsByFacilitator(facilitatorId: string): Promise<SessionSummary[]> {
    try {
      const sessions = await prisma.gameSession.findMany({
        where: { facilitatorId },
        orderBy: { createdAt: 'desc' },
      });

      return sessions.map(this.toSummary);
    } catch (error) {
      console.error('Get sessions error:', error);
      return [];
    }
  }

  /**
   * Get a single session by code
   */
  async getSessionByCode(code: string): Promise<SessionSummary | null> {
    try {
      const session = await prisma.gameSession.findUnique({
        where: { code },
      });

      return session ? this.toSummary(session) : null;
    } catch {
      return null;
    }
  }

  /**
   * Get a single session by ID
   */
  async getSessionById(id: string): Promise<SessionSummary | null> {
    try {
      const session = await prisma.gameSession.findUnique({
        where: { id },
      });

      return session ? this.toSummary(session) : null;
    } catch {
      return null;
    }
  }

  /**
   * Verify that a session belongs to a facilitator
   */
  async verifySessionOwnership(sessionId: string, facilitatorId: string): Promise<boolean> {
    try {
      const session = await prisma.gameSession.findFirst({
        where: {
          id: sessionId,
          facilitatorId,
        },
      });

      return session !== null;
    } catch {
      return false;
    }
  }

  /**
   * Update session status
   */
  async updateSessionStatus(sessionId: string, status: SessionStatus): Promise<boolean> {
    try {
      const updateData: { status: SessionStatus; startedAt?: Date; finishedAt?: Date } = { status };

      if (status === 'ACTIVE') {
        updateData.startedAt = new Date();
      } else if (status === 'FINISHED') {
        updateData.finishedAt = new Date();
      }

      await prisma.gameSession.update({
        where: { id: sessionId },
        data: updateData,
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a session (only if in SETUP or FINISHED status)
   */
  async deleteSession(sessionId: string, facilitatorId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const session = await prisma.gameSession.findFirst({
        where: {
          id: sessionId,
          facilitatorId,
        },
      });

      if (!session) {
        return { success: false, error: 'Сессия не найдена' };
      }

      if (session.status === 'ACTIVE' || session.status === 'PAUSED') {
        return { success: false, error: 'Нельзя удалить активную сессию' };
      }

      await prisma.gameSession.delete({
        where: { id: sessionId },
      });

      return { success: true };
    } catch (error) {
      console.error('Delete session error:', error);
      return { success: false, error: 'Ошибка удаления сессии' };
    }
  }

  /**
   * Generate a unique 6-character uppercase code
   */
  private async generateUniqueCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars (I, O, 0, 1)
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Check if code is unique
      const existing = await prisma.gameSession.findUnique({
        where: { code },
      });

      if (!existing) {
        return code;
      }

      attempts++;
    }

    // Fallback to nanoid if we can't generate a unique code
    return nanoid(8).toUpperCase();
  }

  private canCreateGameWithPlayers(subscriptionType: SubscriptionType, playerCount: number): boolean {
    if (playerCount <= 4) {
      return true;
    }
    return subscriptionType === 'PRO' || subscriptionType === 'ENTERPRISE';
  }

  private toSummary(session: GameSession): SessionSummary {
    return {
      id: session.id,
      code: session.code,
      name: session.name,
      status: session.status,
      playerCount: session.playerCount,
      createdAt: session.createdAt,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
    };
  }
}

export const sessionService = new SessionService();
