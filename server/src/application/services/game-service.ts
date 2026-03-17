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
import type { GameStateRepository } from '../../domain/repositories/game-state-repository.js';
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

  // ============ GAME SETUP & CONFIGURATION ============

  /**
   * Настройка игры перед началом.
   * Активирует нужное количество ролей по приоритету.
   */
  configureGame(config: {
    playerCount: number;
    difficulty: Difficulty;
    distributionMode: DistributionMode;
  }): GameState | null {
    const state = this.getState();
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

    this.repository.save(updatedState);
    return updatedState;
  }

  /**
   * Игрок занимает роль (для онлайн-распределения).
   */
  claimRole(
    roleId: number,
    playerName: string
  ): { success: boolean; error?: string; state?: GameState; token?: string } {
    const state = this.getState();
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
    this.repository.save(updatedState);

    return { success: true, state: updatedState, token: role.token };
  }

  /**
   * Освободить роль (админ может снять игрока).
   */
  unclaimRole(roleId: number): GameState | null {
    const state = this.getState();
    if (!state) return null;

    const updatedRoles = state.roles.map((r) =>
      r.id === roleId ? { ...r, claimedBy: null } : r
    );

    const updatedState: GameState = { ...state, roles: updatedRoles };
    this.repository.save(updatedState);
    return updatedState;
  }

  /**
   * Проверить готовность к старту (все активные роли заняты).
   */
  isReadyToStart(): boolean {
    const state = this.getState();
    if (!state) return false;

    const activeRoles = state.roles.filter((r) => r.isActive);
    return activeRoles.every((r) => r.claimedBy !== null);
  }

  /**
   * Получить список свободных ролей.
   */
  getAvailableRoles(): Array<{ id: number; name: string; isActive: boolean; claimedBy: string | null }> {
    const state = this.getState();
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
   * Начать игру — раздать ресурсы и перейти в фазу playing.
   */
  startGame(): { success: boolean; error?: string; state?: GameState } {
    const state = this.getState();
    if (!state) return { success: false, error: 'Нет активной сессии' };

    if (state.settings.gamePhase !== 'distribution') {
      return { success: false, error: 'Игра не в фазе распределения' };
    }

    // Для онлайн-распределения все роли должны быть заняты
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

    // Раздаём ресурсы если не manual режим
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

    this.repository.save(updatedState);
    return { success: true, state: updatedState };
  }

  /**
   * Завершить игру.
   */
  finishGame(): GameState | null {
    const state = this.getState();
    if (!state) return null;

    const updatedSettings: GameSettings = {
      ...state.settings,
      gamePhase: 'finished',
    };

    const updatedState: GameState = { ...state, settings: updatedSettings };
    this.repository.save(updatedState);
    return updatedState;
  }

  /**
   * Обновить фазу игры.
   */
  setGamePhase(phase: GamePhase): GameState | null {
    const state = this.getState();
    if (!state) return null;

    const updatedSettings: GameSettings = {
      ...state.settings,
      gamePhase: phase,
    };

    const updatedState: GameState = { ...state, settings: updatedSettings };
    this.repository.save(updatedState);
    return updatedState;
  }

  /**
   * Получить лобби-токен для онлайн-распределения.
   * Это просто sessionId, который используется как идентификатор лобби.
   */
  getLobbyToken(): string | null {
    const state = this.getState();
    if (!state) return null;
    return state.sessionId;
  }

  // ============ EVENT SYSTEM ============

  /**
   * Обновить настройки событий.
   */
  updateEventSettings(settings: {
    enabled?: boolean;
    probability?: number;
    enabledEventIds?: number[];
  }): GameState | null {
    const state = this.getState();
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
    this.repository.save(updatedState);
    return updatedState;
  }

  /**
   * Запустить событие (показать игрокам).
   */
  triggerEvent(eventId: number): GameState | null {
    const state = this.getState();
    if (!state) return null;

    // Проверить что событие ещё не было запущено
    if (state.triggeredEvents.some((e) => e.eventId === eventId)) {
      return null; // Событие уже было
    }

    const updatedState: GameState = {
      ...state,
      activeEvent: {
        eventId,
        showingToPlayers: true,
        awaitingChoice: false, // Будет true для dilemma событий
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

    this.repository.save(updatedState);
    return updatedState;
  }

  /**
   * Запустить событие с выбором (dilemma).
   */
  triggerDilemmaEvent(eventId: number): GameState | null {
    const state = this.getState();
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

    this.repository.save(updatedState);
    return updatedState;
  }

  /**
   * Скрыть активное событие.
   */
  dismissEvent(): GameState | null {
    const state = this.getState();
    if (!state) return null;

    const updatedState: GameState = {
      ...state,
      activeEvent: null,
    };

    this.repository.save(updatedState);
    return updatedState;
  }

  /**
   * Применить эффект события (ресурсы).
   */
  applyEventEffect(
    resourceType: ResourceName | 'all',
    amount: number,
    targetZone: ZoneName | 'all'
  ): GameState | null {
    const state = this.getState();
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

    this.repository.save(updatedState);
    return updatedState;
  }

  /**
   * Записать выбор для события-дилеммы.
   */
  recordEventChoice(eventId: number, choiceText: string): GameState | null {
    const state = this.getState();
    if (!state) return null;

    const updatedTriggeredEvents = state.triggeredEvents.map((e) =>
      e.eventId === eventId ? { ...e, choiceMade: choiceText } : e
    );

    const updatedState: GameState = {
      ...state,
      triggeredEvents: updatedTriggeredEvents,
      activeEvent: null, // Закрываем событие после выбора
    };

    this.repository.save(updatedState);
    return updatedState;
  }

  /**
   * Получить список доступных событий для текущего акта.
   * Возвращает eventIds которые: включены, подходят по стадии, ещё не запускались.
   */
  getAvailableEvents(): number[] {
    const state = this.getState();
    if (!state) return [];

    const { enabledEventIds } = state.settings.eventSettings;
    const triggeredIds = state.triggeredEvents.map((e) => e.eventId);

    // Фильтруем: включённые, не запущенные
    return enabledEventIds.filter((id) => !triggeredIds.includes(id));
  }
}
