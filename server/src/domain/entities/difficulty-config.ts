import type { Difficulty, PlayerResources } from './game-state.js';

/**
 * Zone Upgrade Cost Table
 *
 * Resources needed to upgrade a zone from one level to the next.
 * | Level | Energy | Materials | Food | Knowledge | Total |
 * |-------|--------|-----------|------|-----------|-------|
 * | 0→1   | 10     | 10        | 5    | 5         | 30    |
 * | 1→2   | 20     | 20        | 10   | 10        | 60    |
 * | 2→3   | 35     | 35        | 20   | 20        | 110   |
 * | 3→4   | 50     | 50        | 30   | 30        | 160   |
 * | 4→5   | 75     | 75        | 50   | 50        | 250   |
 * | Total | 190    | 190       | 115  | 115       | 610   |
 */
export const ZONE_UPGRADE_COSTS: readonly { readonly level: number; readonly cost: PlayerResources }[] = [
  { level: 1, cost: { energy: 10, materials: 10, food: 5, knowledge: 5 } },
  { level: 2, cost: { energy: 20, materials: 20, food: 10, knowledge: 10 } },
  { level: 3, cost: { energy: 35, materials: 35, food: 20, knowledge: 20 } },
  { level: 4, cost: { energy: 50, materials: 50, food: 30, knowledge: 30 } },
  { level: 5, cost: { energy: 75, materials: 75, food: 50, knowledge: 50 } },
] as const;

/**
 * Total resources needed to upgrade one zone from 0 to 5.
 */
export const TOTAL_PER_ZONE = 610;

/**
 * Total zones that can be upgraded (center, residential, industrial, green).
 */
export const UPGRADEABLE_ZONES_COUNT = 4;

/**
 * Total resources needed to max all zones.
 */
export const TOTAL_CITY_RESOURCES = TOTAL_PER_ZONE * UPGRADEABLE_ZONES_COUNT; // 2440

/**
 * Difficulty multipliers and target zones.
 */
export const DIFFICULTY_CONFIG: Record<Difficulty, { zones: number; multiplier: number }> = {
  easy: { zones: 4, multiplier: 1.2 },    // All zones + 20% buffer
  normal: { zones: 3, multiplier: 1.0 },  // 3 zones exactly
  hard: { zones: 2, multiplier: 1.0 },    // 2 zones exactly
  manual: { zones: 0, multiplier: 0 },    // No auto-distribution
} as const;

/**
 * Calculates total resources available per player based on difficulty.
 */
export function calculateResourcesPerPlayer(playerCount: number, difficulty: Difficulty): number {
  const config = DIFFICULTY_CONFIG[difficulty];
  if (config.zones === 0) return 0;

  const totalResources = TOTAL_PER_ZONE * config.zones * config.multiplier;
  return Math.floor(totalResources / playerCount);
}

/**
 * Creates PlayerResources object with evenly distributed resources.
 */
export function createPlayerResources(totalAmount: number): PlayerResources {
  const perResource = Math.floor(totalAmount / 4);
  const remainder = totalAmount - (perResource * 4);

  return {
    energy: perResource + (remainder >= 1 ? 1 : 0),
    materials: perResource + (remainder >= 2 ? 1 : 0),
    food: perResource + (remainder >= 3 ? 1 : 0),
    knowledge: perResource,
  };
}

/**
 * Distributes resources to all active players based on difficulty.
 */
export function calculateDistributedResources(
  playerCount: number,
  difficulty: Difficulty
): PlayerResources {
  const totalPerPlayer = calculateResourcesPerPlayer(playerCount, difficulty);
  return createPlayerResources(totalPerPlayer);
}

/**
 * Returns resources needed to upgrade zone to next level.
 */
export function getUpgradeCost(currentLevel: number): PlayerResources | null {
  if (currentLevel < 0 || currentLevel >= 5) return null;
  return ZONE_UPGRADE_COSTS[currentLevel].cost;
}

/**
 * Checks if zone resources are sufficient for upgrade.
 */
export function canAffordUpgrade(
  zoneResources: PlayerResources,
  currentLevel: number
): boolean {
  const cost = getUpgradeCost(currentLevel);
  if (!cost) return false;

  return (
    zoneResources.energy >= cost.energy &&
    zoneResources.materials >= cost.materials &&
    zoneResources.food >= cost.food &&
    zoneResources.knowledge >= cost.knowledge
  );
}

/**
 * Subtracts upgrade cost from zone resources.
 * Returns new resources object or null if insufficient.
 */
export function subtractUpgradeCost(
  zoneResources: PlayerResources,
  currentLevel: number
): PlayerResources | null {
  const cost = getUpgradeCost(currentLevel);
  if (!cost || !canAffordUpgrade(zoneResources, currentLevel)) return null;

  return {
    energy: zoneResources.energy - cost.energy,
    materials: zoneResources.materials - cost.materials,
    food: zoneResources.food - cost.food,
    knowledge: zoneResources.knowledge - cost.knowledge,
  };
}
