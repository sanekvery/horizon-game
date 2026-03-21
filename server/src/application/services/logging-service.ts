import { PrismaClient, ActorType, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface HistoryOptions {
  limit?: number;
  offset?: number;
  actorType?: ActorType;
  actionTypes?: string[];
  fromDate?: Date;
  toDate?: Date;
}

export interface SessionStats {
  totalActions: number;
  playerActions: number;
  adminActions: number;
  systemActions: number;
  duration: number;
  topActions: { actionType: string; count: number }[];
}

export interface ActionLogEntry {
  id: string;
  sessionId: string;
  playerId: string | null;
  actorType: ActorType;
  actionType: string;
  actionData: Record<string, unknown>;
  gameContext: Record<string, unknown>;
  createdAt: Date;
  playerName?: string | null;
}

/**
 * Service for logging game actions to PostgreSQL.
 * Records all player, admin, and system actions for history and analytics.
 */
export class LoggingService {
  /**
   * Get session ID from session code.
   */
  private async getSessionId(sessionCode: string): Promise<string | null> {
    const session = await prisma.gameSession.findUnique({
      where: { code: sessionCode },
      select: { id: true },
    });
    return session?.id ?? null;
  }

  /**
   * Get current game context (act, scene, phase) for a session.
   */
  private async getGameContext(sessionCode: string): Promise<Record<string, unknown>> {
    const session = await prisma.gameSession.findUnique({
      where: { code: sessionCode },
      select: { state: true },
    });

    if (!session?.state || typeof session.state !== 'object') {
      return {};
    }

    const state = session.state as Record<string, unknown>;
    return {
      act: state.currentAct,
      scene: state.currentScene,
      phase: (state.settings as Record<string, unknown>)?.gamePhase,
    };
  }

  /**
   * Get player ID by role ID within a session.
   */
  private async getPlayerId(sessionCode: string, roleId: number): Promise<string | null> {
    const session = await prisma.gameSession.findUnique({
      where: { code: sessionCode },
      select: { id: true },
    });

    if (!session) return null;

    const player = await prisma.sessionPlayer.findFirst({
      where: {
        sessionId: session.id,
        roleId,
      },
      select: { id: true },
    });

    return player?.id ?? null;
  }

  /**
   * Log a player action.
   */
  async logPlayerAction(
    sessionCode: string,
    roleId: number,
    actionType: string,
    actionData: Record<string, unknown>
  ): Promise<void> {
    const sessionId = await this.getSessionId(sessionCode);
    if (!sessionId) return;

    const playerId = await this.getPlayerId(sessionCode, roleId);
    const gameContext = await this.getGameContext(sessionCode);

    await prisma.actionLog.create({
      data: {
        sessionId,
        playerId,
        actorType: ActorType.PLAYER,
        actionType,
        actionData: actionData as Prisma.InputJsonValue,
        gameContext: gameContext as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Log an admin/facilitator action.
   */
  async logAdminAction(
    sessionCode: string,
    actionType: string,
    actionData: Record<string, unknown>
  ): Promise<void> {
    const sessionId = await this.getSessionId(sessionCode);
    if (!sessionId) return;

    const gameContext = await this.getGameContext(sessionCode);

    await prisma.actionLog.create({
      data: {
        sessionId,
        actorType: ActorType.FACILITATOR,
        actionType,
        actionData: actionData as Prisma.InputJsonValue,
        gameContext: gameContext as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Log a system action.
   */
  async logSystemAction(
    sessionCode: string,
    actionType: string,
    actionData: Record<string, unknown>
  ): Promise<void> {
    const sessionId = await this.getSessionId(sessionCode);
    if (!sessionId) return;

    const gameContext = await this.getGameContext(sessionCode);

    await prisma.actionLog.create({
      data: {
        sessionId,
        actorType: ActorType.SYSTEM,
        actionType,
        actionData: actionData as Prisma.InputJsonValue,
        gameContext: gameContext as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Get action history for a session.
   */
  async getSessionHistory(
    sessionCode: string,
    options: HistoryOptions = {}
  ): Promise<ActionLogEntry[]> {
    const sessionId = await this.getSessionId(sessionCode);
    if (!sessionId) return [];

    const { limit = 50, offset = 0, actorType, actionTypes, fromDate, toDate } = options;

    const where: Prisma.ActionLogWhereInput = {
      sessionId,
      ...(actorType && { actorType }),
      ...(actionTypes?.length && { actionType: { in: actionTypes } }),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate && { gte: fromDate }),
              ...(toDate && { lte: toDate }),
            },
          }
        : {}),
    };

    const logs = await prisma.actionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        player: {
          select: { playerName: true },
        },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      sessionId: log.sessionId,
      playerId: log.playerId,
      actorType: log.actorType,
      actionType: log.actionType,
      actionData: log.actionData as Record<string, unknown>,
      gameContext: log.gameContext as Record<string, unknown>,
      createdAt: log.createdAt,
      playerName: log.player?.playerName,
    }));
  }

  /**
   * Get statistics for a session.
   */
  async getSessionStats(sessionCode: string): Promise<SessionStats | null> {
    const session = await prisma.gameSession.findUnique({
      where: { code: sessionCode },
      select: {
        id: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
      },
    });

    if (!session) return null;

    // Count by actor type
    const actorCounts = await prisma.actionLog.groupBy({
      by: ['actorType'],
      where: { sessionId: session.id },
      _count: true,
    });

    const playerActions = actorCounts.find((c) => c.actorType === ActorType.PLAYER)?._count ?? 0;
    const adminActions = actorCounts.find((c) => c.actorType === ActorType.FACILITATOR)?._count ?? 0;
    const systemActions = actorCounts.find((c) => c.actorType === ActorType.SYSTEM)?._count ?? 0;
    const totalActions = playerActions + adminActions + systemActions;

    // Top actions
    const topActionsRaw = await prisma.actionLog.groupBy({
      by: ['actionType'],
      where: { sessionId: session.id },
      _count: true,
      orderBy: { _count: { actionType: 'desc' } },
      take: 10,
    });

    const topActions = topActionsRaw.map((a) => ({
      actionType: a.actionType,
      count: a._count,
    }));

    // Duration calculation
    const startTime = session.startedAt ?? session.createdAt;
    const endTime = session.finishedAt ?? new Date();
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

    return {
      totalActions,
      playerActions,
      adminActions,
      systemActions,
      duration,
      topActions,
    };
  }
}

// Singleton instance
export const loggingService = new LoggingService();
