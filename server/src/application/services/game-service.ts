import { nanoid } from 'nanoid';
import type {
  GameState,
  ZoneName,
  ResourceName,
  Vote,
  VoteOption,
} from '../../domain/entities/game-state.js';
import type { GameStateRepository } from '../../domain/repositories/game-state-repository.js';
import {
  getUpgradeCost,
  canAffordUpgrade,
  subtractCost,
} from '../../domain/entities/zone-upgrade-costs.js';

export interface UpgradeResult {
  success: boolean;
  error?: string;
  newLevel?: number;
}

export class GameService {
  constructor(private readonly repository: GameStateRepository) {}

  getOrCreateSession(): GameState {
    const existing = this.repository.getCurrentSession();
    if (existing) return existing;
    return this.repository.createSession(nanoid(12));
  }

  getState(): GameState | null {
    return this.repository.getCurrentSession();
  }

  getRoleByToken(token: string): GameState['roles'][number] | null {
    const state = this.getState();
    if (!state) return null;
    return state.roles.find((r) => r.token === token) || null;
  }

  connectPlayer(token: string): GameState | null {
    const state = this.getState();
    if (!state) return null;

    const roleIndex = state.roles.findIndex((r) => r.token === token);
    if (roleIndex === -1) return null;

    const updatedRoles = state.roles.map((role, i) =>
      i === roleIndex ? { ...role, connected: true } : role
    );

    const updatedState: GameState = { ...state, roles: updatedRoles };
    this.repository.save(updatedState);
    return updatedState;
  }

  disconnectPlayer(token: string): GameState | null {
    const state = this.getState();
    if (!state) return null;

    const updatedRoles = state.roles.map((role) =>
      role.token === token ? { ...role, connected: false } : role
    );

    const updatedState: GameState = { ...state, roles: updatedRoles };
    this.repository.save(updatedState);
    return updatedState;
  }

  setAct(act: 1 | 2 | 3 | 4 | 5): GameState | null {
    const state = this.getState();
    if (!state) return null;

    const updatedState: GameState = { ...state, currentAct: act, currentScene: 1 };
    this.repository.save(updatedState);
    return updatedState;
  }

  setScene(scene: number): GameState | null {
    const state = this.getState();
    if (!state) return null;

    const updatedState: GameState = { ...state, currentScene: scene };
    this.repository.save(updatedState);
    return updatedState;
  }

  startTimer(seconds: number): GameState | null {
    const state = this.getState();
    if (!state) return null;

    const updatedState: GameState = {
      ...state,
      timer: { running: true, remainingSec: seconds },
    };
    this.repository.save(updatedState);
    return updatedState;
  }

  tickTimer(): GameState | null {
    const state = this.getState();
    if (!state || !state.timer.running) return state;

    const newRemaining = Math.max(0, state.timer.remainingSec - 1);
    const updatedState: GameState = {
      ...state,
      timer: {
        running: newRemaining > 0,
        remainingSec: newRemaining,
      },
    };
    this.repository.save(updatedState);
    return updatedState;
  }

  stopTimer(): GameState | null {
    const state = this.getState();
    if (!state) return null;

    const updatedState: GameState = {
      ...state,
      timer: { ...state.timer, running: false },
    };
    this.repository.save(updatedState);
    return updatedState;
  }

  updateZoneLevel(zone: ZoneName, level: number): GameState | null {
    const state = this.getState();
    if (!state) return null;

    if (zone === 'unknown') return state;

    const updatedZones = {
      ...state.zones,
      [zone]: { ...state.zones[zone], level },
    };

    const updatedState: GameState = { ...state, zones: updatedZones };
    this.repository.save(updatedState);
    return updatedState;
  }

  updateZoneResource(
    zone: ZoneName,
    resource: ResourceName,
    amount: number
  ): GameState | null {
    const state = this.getState();
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
    this.repository.save(updatedState);
    return updatedState;
  }

  revealUnknownZone(): GameState | null {
    const state = this.getState();
    if (!state) return null;

    const updatedState: GameState = {
      ...state,
      zones: {
        ...state.zones,
        unknown: { revealed: true },
      },
    };
    this.repository.save(updatedState);
    return updatedState;
  }

  createVote(question: string, options: string[]): GameState | null {
    const state = this.getState();
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
    this.repository.save(updatedState);
    return updatedState;
  }

  startVote(voteId: string): GameState | null {
    const state = this.getState();
    if (!state) return null;

    const updatedVotes = state.votes.map((v) =>
      v.id === voteId ? { ...v, status: 'active' as const } : v
    );

    const updatedState: GameState = { ...state, votes: updatedVotes };
    this.repository.save(updatedState);
    return updatedState;
  }

  castVote(voteId: string, optionId: string): GameState | null {
    const state = this.getState();
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
    this.repository.save(updatedState);
    return updatedState;
  }

  closeVote(voteId: string): GameState | null {
    const state = this.getState();
    if (!state) return null;

    const updatedVotes = state.votes.map((v) =>
      v.id === voteId ? { ...v, status: 'closed' as const } : v
    );

    const updatedState: GameState = { ...state, votes: updatedVotes };
    this.repository.save(updatedState);
    return updatedState;
  }

  lightCandle(candleId: number): GameState | null {
    const state = this.getState();
    if (!state) return null;

    if (state.candlesLit.includes(candleId)) return state;

    const updatedState: GameState = {
      ...state,
      candlesLit: [...state.candlesLit, candleId],
    };
    this.repository.save(updatedState);
    return updatedState;
  }

  revealFog(): GameState | null {
    const state = this.getState();
    if (!state) return null;

    const updatedState: GameState = { ...state, fogRevealed: true };
    this.repository.save(updatedState);
    return updatedState;
  }

  setPromise(roleId: number, text: string, deadline: string): GameState | null {
    const state = this.getState();
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
    this.repository.save(updatedState);
    return updatedState;
  }

  revealSecret(roleId: number): GameState | null {
    const state = this.getState();
    if (!state) return null;

    const updatedRoles = state.roles.map((r) =>
      r.id === roleId ? { ...r, secretRevealed: true } : r
    );

    const updatedState: GameState = { ...state, roles: updatedRoles };
    this.repository.save(updatedState);
    return updatedState;
  }

  resetSession(): GameState {
    return this.repository.createSession(nanoid(12));
  }

  // ============ PLAYER RESOURCES ============

  /**
   * Обновить ресурс игрока (установить абсолютное значение).
   */
  updatePlayerResource(
    roleId: number,
    resource: ResourceName,
    amount: number
  ): GameState | null {
    const state = this.getState();
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
    this.repository.save(updatedState);
    return updatedState;
  }

  /**
   * Добавить ресурсы игроку (инкремент).
   */
  givePlayerResource(
    roleId: number,
    resource: ResourceName,
    amount: number
  ): GameState | null {
    const state = this.getState();
    if (!state) return null;

    const role = state.roles.find((r) => r.id === roleId);
    if (!role) return null;

    const currentAmount = role.resources[resource];
    return this.updatePlayerResource(roleId, resource, currentAmount + amount);
  }

  /**
   * Игрок вносит ресурсы в зону.
   * Списывает из личного пула игрока, добавляет в пул зоны.
   */
  contributeToZone(
    roleId: number,
    zone: ZoneName,
    resource: ResourceName,
    amount: number
  ): { success: boolean; error?: string; state?: GameState } {
    const state = this.getState();
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

    // Списываем у игрока
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

    // Добавляем в зону
    const updatedZones = {
      ...state.zones,
      [zone]: {
        ...currentZone,
        resources: {
          ...currentZone.resources,
          [resource]: currentZone.resources[resource] + amount,
        },
      },
    };

    const updatedState: GameState = {
      ...state,
      roles: updatedRoles,
      zones: updatedZones,
    };
    this.repository.save(updatedState);
    return { success: true, state: updatedState };
  }

  /**
   * Улучшить зону с автоматической проверкой и списанием ресурсов.
   */
  upgradeZone(zone: ZoneName): UpgradeResult & { state?: GameState } {
    const state = this.getState();
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

    // Списываем ресурсы и повышаем уровень
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
    this.repository.save(updatedState);
    return { success: true, newLevel, state: updatedState };
  }
}
