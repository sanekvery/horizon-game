/**
 * Role Priority Configuration
 *
 * Defines the order in which roles are activated based on player count.
 * Priority tiers:
 * - A (Critical): Stranger, Commander, Scout, Historian
 * - B (Drama): Child (Masha), Diplomat, Psychologist
 * - C (Medium): Doctor, Banker, Engineer, Ecologist
 * - D (Functional): All other roles
 */

export const ROLE_PRIORITY: readonly number[] = [
  20, // Незнакомец (Stranger) - главный антагонист
  1,  // Командор (Commander) - лидер
  11, // Разведчик (Scout) - знает о Незнакомце
  18, // Историк (Historian) - знает правду о городе
  19, // Маша (Child) - дочь Незнакомца, драма
  14, // Дипломат (Diplomat) - шпион
  15, // Психолог (Psychologist) - манипулятор
  4,  // Доктор (Doctor) - важная профессия
  7,  // Банкир (Banker) - экономика
  2,  // Инженер (Engineer) - техника
  17, // Эколог (Ecologist) - зелёная зона
  3,  // Архитектор (Architect)
  5,  // Учитель (Teacher)
  6,  // Фермер (Farmer)
  8,  // Журналист (Journalist)
  9,  // Художник (Artist)
  10, // Судья (Judge)
  12, // Священник (Priest)
  13, // Технолог (Technologist)
  16, // Строитель (Builder)
] as const;

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 20;

/**
 * Returns array of active role IDs for given player count.
 * Roles are selected based on priority order.
 */
export function getActiveRoleIds(playerCount: number): number[] {
  const clampedCount = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, playerCount));
  return [...ROLE_PRIORITY.slice(0, clampedCount)];
}

/**
 * Checks if a role ID is active for given player count.
 */
export function isRoleActive(roleId: number, playerCount: number): boolean {
  const activeIds = getActiveRoleIds(playerCount);
  return activeIds.includes(roleId);
}

/**
 * Returns human-readable priority tier for a role.
 */
export function getRoleTier(roleId: number): 'A' | 'B' | 'C' | 'D' {
  const tierA = [20, 1, 11, 18];
  const tierB = [19, 14, 15];
  const tierC = [4, 7, 2, 17];

  if (tierA.includes(roleId)) return 'A';
  if (tierB.includes(roleId)) return 'B';
  if (tierC.includes(roleId)) return 'C';
  return 'D';
}
