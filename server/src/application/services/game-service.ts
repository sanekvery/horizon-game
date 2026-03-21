import { nanoid } from 'nanoid';
import type {
  GameState,
  ZoneName,
  ResourceName,
  Vote,
  VoteOption,
  Difficulty,
  DistributionMode,
  GamePhase,
  GameSettings,
} from '../../domain/entities/game-state.js';
import type { SessionAwareGameStateRepository } from '../../domain/repositories/game-state-repository.js';
import {
  getUpgradeCost,
  canAffordUpgrade,
  subtractCost,
} from '../../domain/entities/zone-upgrade-costs.js';
import { getActiveRoleIds } from '../../domain/entities/role-priority.js';
import { calculateDistributedResources } from '../../domain/entities/difficulty-config.js';

export interface UpgradeResult {
  success: boolean;
  error?: string;
  newLevel?: number;
}

/**
 * Session-aware GameService for multi-session support.
 * All methods now accept sessionCode as the first parameter.
 */
export class GameService {
  constructor(private readonly repository: SessionAwareGameStateRepository) {}

  /**
   * Get or initialize game state for a session.
   */
  async getOrCreateSession(sessionCode: string, playerCount: number): Promise<GameState | null> {
    const existing = await this.repository.getSessionState(sessionCode);
    if (existing) return existing;
    return this.repository.initializeSession(sessionCode, playerCount);
  }

  /**
   * Get current state for a session.
   */
  async getState(sessionCode: string): Promise<GameState | null> {
    return this.repository.getSessionState(sessionCode);
  }

  /**
   * Find role by token within a session.
   */
  async getRoleByToken(sessionCode: string, token: string): Promise<GameState['roles'][number] | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;
    return state.roles.find((r) => r.token === token) || null;
  }

  /**
   * Connect player by token.
   */
  async connectPlayer(sessionCode: string, token: string): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const roleIndex = state.roles.findIndex((r) => r.token === token);
    if (roleIndex === -1) return null;

    const updatedRoles = state.roles.map((role, i) =>
      i === roleIndex ? { ...role, connected: true } : role
    );

    const updatedState: GameState = { ...state, roles: updatedRoles };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Disconnect player by token.
   */
  async disconnectPlayer(sessionCode: string, token: string): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const updatedRoles = state.roles.map((role) =>
      role.token === token ? { ...role, connected: false } : role
    );

    const updatedState: GameState = { ...state, roles: updatedRoles };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Set current act.
   */
  async setAct(sessionCode: string, act: 1 | 2 | 3 | 4 | 5): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const updatedState: GameState = { ...state, currentAct: act, currentScene: 1 };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Set current scene.
   */
  async setScene(sessionCode: string, scene: number): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const updatedState: GameState = { ...state, currentScene: scene };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Start timer with given seconds.
   */
  async startTimer(sessionCode: string, seconds: number): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const updatedState: GameState = {
      ...state,
      timer: { running: true, remainingSec: seconds },
    };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Tick timer (decrement by 1 second).
   */
  async tickTimer(sessionCode: string): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state || !state.timer.running) return state;

    const newRemaining = Math.max(0, state.timer.remainingSec - 1);
    const updatedState: GameState = {
      ...state,
      timer: {
        running: newRemaining > 0,
        remainingSec: newRemaining,
      },
    };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Stop timer.
   */
  async stopTimer(sessionCode: string): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const updatedState: GameState = {
      ...state,
      timer: { ...state.timer, running: false },
    };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Update zone level.
   */
  async updateZoneLevel(sessionCode: string, zone: ZoneName, level: number): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    if (zone === 'unknown') return state;

    const updatedZones = {
      ...state.zones,
      [zone]: { ...state.zones[zone], level },
    };

    const updatedState: GameState = { ...state, zones: updatedZones };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Update zone resource amount.
   */
  async updateZoneResource(
    sessionCode: string,
    zone: ZoneName,
    resource: ResourceName,
    amount: number
  ): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    if (zone === 'unknown') return state;

    const currentZone = state.zones[zone];
    if (!('resources' in currentZone)) return state;

    const updatedZones = {
      ...state.zones,
      [zone]: {
        ...currentZone,
        resources: {
          ...currentZone.resources,
          [resource]: amount,
        },
      },
    };

    const updatedState: GameState = { ...state, zones: updatedZones };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Reveal unknown zone.
   */
  async revealUnknownZone(sessionCode: string): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const updatedState: GameState = {
      ...state,
      zones: {
        ...state.zones,
        unknown: { revealed: true },
      },
    };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Create a new vote.
   */
  async createVote(sessionCode: string, question: string, options: string[]): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const voteOptions: VoteOption[] = options.map((text, i) => ({
      id: `opt_${i}`,
      text,
    }));

    const newVote: Vote = {
      id: nanoid(8),
      question,
      options: voteOptions,
      results: Object.fromEntries(voteOptions.map((o) => [o.id, 0])),
      status: 'pending',
    };

    const updatedState: GameState = {
      ...state,
      votes: [...state.votes, newVote],
    };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Start a vote.
   */
  async startVote(sessionCode: string, voteId: string): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const updatedVotes = state.votes.map((v) =>
      v.id === voteId ? { ...v, status: 'active' as const } : v
    );

    const updatedState: GameState = { ...state, votes: updatedVotes };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Cast a vote.
   */
  async castVote(sessionCode: string, voteId: string, optionId: string): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const vote = state.votes.find((v) => v.id === voteId);
    if (!vote || vote.status !== 'active') return state;

    const updatedVotes = state.votes.map((v) =>
      v.id === voteId
        ? {
            ...v,
            results: {
              ...v.results,
              [optionId]: (v.results[optionId] || 0) + 1,
            },
          }
        : v
    );

    const updatedState: GameState = { ...state, votes: updatedVotes };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Close a vote.
   */
  async closeVote(sessionCode: string, voteId: string): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const updatedVotes = state.votes.map((v) =>
      v.id === voteId ? { ...v, status: 'closed' as const } : v
    );

    const updatedState: GameState = { ...state, votes: updatedVotes };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Light a candle.
   */
  async lightCandle(sessionCode: string, candleId: number): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    if (state.candlesLit.includes(candleId)) return state;

    const updatedState: GameState = {
      ...state,
      candlesLit: [...state.candlesLit, candleId],
    };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Reveal fog.
   */
  async revealFog(sessionCode: string): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const updatedState: GameState = { ...state, fogRevealed: true };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Set player promise.
   */
  async setPromise(sessionCode: string, roleId: number, text: string, deadline: string): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const existingIndex = state.promises.findIndex((p) => p.roleId === roleId);
    const newPromise = { roleId, text, deadline };

    const updatedPromises =
      existingIndex >= 0
        ? state.promises.map((p, i) => (i === existingIndex ? newPromise : p))
        : [...state.promises, newPromise];

    const updatedRoles = state.roles.map((r) =>
      r.id === roleId ? { ...r, promise: text } : r
    );

    const updatedState: GameState = {
      ...state,
      promises: updatedPromises,
      roles: updatedRoles,
    };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Reveal role secret.
   */
  async revealSecret(sessionCode: string, roleId: number): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const updatedRoles = state.roles.map((r) =>
      r.id === roleId ? { ...r, secretRevealed: true } : r
    );

    const updatedState: GameState = { ...state, roles: updatedRoles };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Reset session - clears state and re-initializes.
   */
  async resetSession(sessionCode: string, playerCount: number): Promise<GameState | null> {
    await this.repository.clearSessionState(sessionCode);
    return this.repository.initializeSession(sessionCode, playerCount);
  }

  // ============ PLAYER RESOURCES ============

  /**
   * Update player resource (set absolute value).
   */
  async updatePlayerResource(
    sessionCode: string,
    roleId: number,
    resource: ResourceName,
    amount: number
  ): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const updatedRoles = state.roles.map((role) =>
      role.id === roleId
        ? {
            ...role,
            resources: {
              ...role.resources,
              [resource]: Math.max(0, amount),
            },
          }
        : role
    );

    const updatedState: GameState = { ...state, roles: updatedRoles };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Give resources to player (increment).
   */
  async givePlayerResource(
    sessionCode: string,
    roleId: number,
    resource: ResourceName,
    amount: number
  ): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const role = state.roles.find((r) => r.id === roleId);
    if (!role) return null;

    const currentAmount = role.resources[resource];
    return this.updatePlayerResource(sessionCode, roleId, resource, currentAmount + amount);
  }

  /**
   * Player contributes resources to zone.
   */
  async contributeToZone(
    sessionCode: string,
    roleId: number,
    zone: ZoneName,
    resource: ResourceName,
    amount: number,
    bonusAmount: number = 0  // Extra resources added to zone (from craft stat bonus)
  ): Promise<{ success: boolean; error?: string; state?: GameState }> {
    const state = await this.getState(sessionCode);
    if (!state) return { success: false, error: 'Нет активной сессии' };

    if (zone === 'unknown') {
      return { success: false, error: 'Нельзя вносить в неизвестную зону' };
    }

    const role = state.roles.find((r) => r.id === roleId);
    if (!role) {
      return { success: false, error: 'Роль не найдена' };
    }

    const currentPlayerAmount = role.resources[resource];
    if (currentPlayerAmount < amount) {
      return { success: false, error: 'Недостаточно ресурсов' };
    }

    const currentZone = state.zones[zone];
    if (!('resources' in currentZone)) {
      return { success: false, error: 'Зона не поддерживает ресурсы' };
    }

    // Subtract from player
    const updatedRoles = state.roles.map((r) =>
      r.id === roleId
        ? {
            ...r,
            resources: {
              ...r.resources,
              [resource]: currentPlayerAmount - amount,
            },
          }
        : r
    );

    // Add to zone (including bonus from craft stat)
    const totalZoneContribution = amount + bonusAmount;
    const updatedZones = {
      ...state.zones,
      [zone]: {
        ...currentZone,
        resources: {
          ...currentZone.resources,
          [resource]: currentZone.resources[resource] + totalZoneContribution,
        },
      },
    };

    const updatedState: GameState = {
      ...state,
      roles: updatedRoles,
      zones: updatedZones,
    };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return { success: true, state: updatedState };
  }

  /**
   * Upgrade zone with automatic resource validation.
   */
  async upgradeZone(sessionCode: string, zone: ZoneName): Promise<UpgradeResult & { state?: GameState }> {
    const state = await this.getState(sessionCode);
    if (!state) return { success: false, error: 'Нет активной сессии' };

    if (zone === 'unknown') {
      return { success: false, error: 'Нельзя улучшить неизвестную зону' };
    }

    const currentZone = state.zones[zone];
    if (!('resources' in currentZone)) {
      return { success: false, error: 'Зона не поддерживает ресурсы' };
    }

    const cost = getUpgradeCost(currentZone.level);
    if (!cost) {
      return { success: false, error: 'Зона на максимальном уровне' };
    }

    if (!canAffordUpgrade(currentZone.resources, cost)) {
      return { success: false, error: 'Недостаточно ресурсов в пуле зоны' };
    }

    // Subtract resources and increase level
    const newResources = subtractCost(currentZone.resources, cost);
    const newLevel = currentZone.level + 1;

    const updatedZones = {
      ...state.zones,
      [zone]: {
        ...currentZone,
        level: newLevel,
        resources: newResources,
      },
    };

    const updatedState: GameState = { ...state, zones: updatedZones };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return { success: true, newLevel, state: updatedState };
  }

  // ============ GAME SETUP & CONFIGURATION ============

  /**
   * Configure game before start.
   */
  async configureGame(
    sessionCode: string,
    config: {
      playerCount: number;
      difficulty: Difficulty;
      distributionMode: DistributionMode;
    }
  ): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const activeRoleIds = getActiveRoleIds(config.playerCount);

    const updatedRoles = state.roles.map((role) => ({
      ...role,
      isActive: activeRoleIds.includes(role.id),
      claimedBy: null,
      resources: { energy: 0, materials: 0, food: 0, knowledge: 0 },
    }));

    const updatedSettings: GameSettings = {
      playerCount: config.playerCount,
      difficulty: config.difficulty,
      distributionMode: config.distributionMode,
      gamePhase: 'distribution',
      eventSettings: state.settings.eventSettings,
    };

    const updatedState: GameState = {
      ...state,
      roles: updatedRoles,
      settings: updatedSettings,
    };

    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Player claims a role (for online distribution).
   */
  async claimRole(
    sessionCode: string,
    roleId: number,
    playerName: string
  ): Promise<{ success: boolean; error?: string; state?: GameState; token?: string }> {
    const state = await this.getState(sessionCode);
    if (!state) return { success: false, error: 'Нет активной сессии' };

    if (state.settings.gamePhase !== 'distribution') {
      return { success: false, error: 'Распределение ролей не активно' };
    }

    const role = state.roles.find((r) => r.id === roleId);
    if (!role) {
      return { success: false, error: 'Роль не найдена' };
    }

    if (!role.isActive) {
      return { success: false, error: 'Роль не активна в этой игре' };
    }

    if (role.claimedBy !== null) {
      return { success: false, error: 'Роль уже занята' };
    }

    const updatedRoles = state.roles.map((r) =>
      r.id === roleId ? { ...r, claimedBy: playerName } : r
    );

    const updatedState: GameState = { ...state, roles: updatedRoles };
    await this.repository.saveSessionState(sessionCode, updatedState);

    return { success: true, state: updatedState, token: role.token };
  }

  /**
   * Unclaim role (admin can remove player).
   */
  async unclaimRole(sessionCode: string, roleId: number): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const updatedRoles = state.roles.map((r) =>
      r.id === roleId ? { ...r, claimedBy: null } : r
    );

    const updatedState: GameState = { ...state, roles: updatedRoles };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Check if all active roles are claimed.
   */
  async isReadyToStart(sessionCode: string): Promise<boolean> {
    const state = await this.getState(sessionCode);
    if (!state) return false;

    const activeRoles = state.roles.filter((r) => r.isActive);
    return activeRoles.every((r) => r.claimedBy !== null);
  }

  /**
   * Get list of available roles.
   */
  async getAvailableRoles(sessionCode: string): Promise<Array<{ id: number; name: string; isActive: boolean; claimedBy: string | null }>> {
    const state = await this.getState(sessionCode);
    if (!state) return [];

    return state.roles
      .filter((r) => r.isActive && r.claimedBy === null)
      .map((r) => ({
        id: r.id,
        name: r.name,
        isActive: r.isActive,
        claimedBy: r.claimedBy,
      }));
  }

  /**
   * Start game - distribute resources and switch to playing phase.
   */
  async startGame(sessionCode: string): Promise<{ success: boolean; error?: string; state?: GameState }> {
    const state = await this.getState(sessionCode);
    if (!state) return { success: false, error: 'Нет активной сессии' };

    if (state.settings.gamePhase !== 'distribution') {
      return { success: false, error: 'Игра не в фазе распределения' };
    }

    // For online distribution, all roles must be claimed
    if (state.settings.distributionMode === 'online') {
      const activeRoles = state.roles.filter((r) => r.isActive);
      const unclaimedRoles = activeRoles.filter((r) => r.claimedBy === null);
      if (unclaimedRoles.length > 0) {
        return {
          success: false,
          error: `Не все роли заняты. Осталось: ${unclaimedRoles.length}`,
        };
      }
    }

    // Distribute resources if not manual mode
    let updatedRoles = state.roles;
    if (state.settings.difficulty !== 'manual') {
      const resources = calculateDistributedResources(
        state.settings.playerCount,
        state.settings.difficulty
      );

      updatedRoles = state.roles.map((role) =>
        role.isActive
          ? { ...role, resources }
          : role
      );
    }

    const updatedSettings: GameSettings = {
      ...state.settings,
      gamePhase: 'playing' as GamePhase,
    };

    const updatedState: GameState = {
      ...state,
      roles: updatedRoles,
      settings: updatedSettings,
    };

    await this.repository.saveSessionState(sessionCode, updatedState);
    return { success: true, state: updatedState };
  }

  /**
   * Finish game.
   */
  async finishGame(sessionCode: string): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const updatedSettings: GameSettings = {
      ...state.settings,
      gamePhase: 'finished',
    };

    const updatedState: GameState = { ...state, settings: updatedSettings };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Set game phase.
   */
  async setGamePhase(sessionCode: string, phase: GamePhase): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const updatedSettings: GameSettings = {
      ...state.settings,
      gamePhase: phase,
    };

    const updatedState: GameState = { ...state, settings: updatedSettings };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Get lobby token for online distribution.
   */
  async getLobbyToken(sessionCode: string): Promise<string | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;
    return state.sessionId;
  }

  // ============ EVENT SYSTEM ============

  /**
   * Update event settings.
   */
  async updateEventSettings(
    sessionCode: string,
    settings: {
      enabled?: boolean;
      probability?: number;
      enabledEventIds?: number[];
    }
  ): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const updatedSettings: GameSettings = {
      ...state.settings,
      eventSettings: {
        ...state.settings.eventSettings,
        ...(settings.enabled !== undefined && { enabled: settings.enabled }),
        ...(settings.probability !== undefined && { probability: settings.probability }),
        ...(settings.enabledEventIds !== undefined && { enabledEventIds: settings.enabledEventIds }),
      },
    };

    const updatedState: GameState = { ...state, settings: updatedSettings };
    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Trigger event (show to players).
   */
  async triggerEvent(sessionCode: string, eventId: number): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    // Check if event was already triggered
    if (state.triggeredEvents.some((e) => e.eventId === eventId)) {
      return null;
    }

    const updatedState: GameState = {
      ...state,
      activeEvent: {
        eventId,
        showingToPlayers: true,
        awaitingChoice: false,
      },
      triggeredEvents: [
        ...state.triggeredEvents,
        {
          eventId,
          triggeredAt: new Date().toISOString(),
          actWhenTriggered: state.currentAct,
          sceneWhenTriggered: state.currentScene,
        },
      ],
    };

    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Trigger dilemma event (with choice).
   */
  async triggerDilemmaEvent(sessionCode: string, eventId: number): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    if (state.triggeredEvents.some((e) => e.eventId === eventId)) {
      return null;
    }

    const updatedState: GameState = {
      ...state,
      activeEvent: {
        eventId,
        showingToPlayers: true,
        awaitingChoice: true,
      },
      triggeredEvents: [
        ...state.triggeredEvents,
        {
          eventId,
          triggeredAt: new Date().toISOString(),
          actWhenTriggered: state.currentAct,
          sceneWhenTriggered: state.currentScene,
        },
      ],
    };

    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Dismiss active event.
   */
  async dismissEvent(sessionCode: string): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const updatedState: GameState = {
      ...state,
      activeEvent: null,
    };

    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Apply event effect (resources).
   */
  async applyEventEffect(
    sessionCode: string,
    resourceType: ResourceName | 'all',
    amount: number,
    targetZone: ZoneName | 'all'
  ): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const zonesToUpdate: Array<Exclude<ZoneName, 'unknown'>> =
      targetZone === 'all'
        ? ['center', 'residential', 'industrial', 'green']
        : targetZone === 'unknown'
        ? []
        : [targetZone];

    const resourcesToUpdate: ResourceName[] =
      resourceType === 'all'
        ? ['energy', 'materials', 'food', 'knowledge']
        : [resourceType];

    let updatedZones = { ...state.zones };

    for (const zone of zonesToUpdate) {
      const currentZone = updatedZones[zone];
      let updatedResources = { ...currentZone.resources };

      for (const resource of resourcesToUpdate) {
        updatedResources = {
          ...updatedResources,
          [resource]: Math.max(0, updatedResources[resource] + amount),
        };
      }

      updatedZones = {
        ...updatedZones,
        [zone]: {
          ...currentZone,
          resources: updatedResources,
        },
      };
    }

    const updatedState: GameState = {
      ...state,
      zones: updatedZones,
    };

    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Record dilemma choice.
   */
  async recordEventChoice(sessionCode: string, eventId: number, choiceText: string): Promise<GameState | null> {
    const state = await this.getState(sessionCode);
    if (!state) return null;

    const updatedTriggeredEvents = state.triggeredEvents.map((e) =>
      e.eventId === eventId ? { ...e, choiceMade: choiceText } : e
    );

    const updatedState: GameState = {
      ...state,
      triggeredEvents: updatedTriggeredEvents,
      activeEvent: null,
    };

    await this.repository.saveSessionState(sessionCode, updatedState);
    return updatedState;
  }

  /**
   * Get available events for current act.
   */
  async getAvailableEvents(sessionCode: string): Promise<number[]> {
    const state = await this.getState(sessionCode);
    if (!state) return [];

    const { enabledEventIds } = state.settings.eventSettings;
    const triggeredIds = state.triggeredEvents.map((e) => e.eventId);

    return enabledEventIds.filter((id) => !triggeredIds.includes(id));
  }
}
