import type { Resources } from './game-state.js';

/**
 * Стоимость улучшения зоны по уровням.
 * Ключ - текущий уровень зоны, значение - стоимость улучшения до следующего уровня.
 */
export const ZONE_UPGRADE_COSTS: Record<number, Resources> = {
  0: { energy: 10, materials: 10, food: 5, knowledge: 5 },
  1: { energy: 20, materials: 20, food: 10, knowledge: 10 },
  2: { energy: 35, materials: 35, food: 20, knowledge: 20 },
  3: { energy: 50, materials: 50, food: 30, knowledge: 30 },
  4: { energy: 75, materials: 75, food: 50, knowledge: 50 },
};

/**
 * Максимальный уровень зоны.
 */
export const MAX_ZONE_LEVEL = 5;

/**
 * Получить стоимость улучшения зоны.
 * @param currentLevel Текущий уровень зоны
 * @returns Стоимость улучшения или null если зона на максимальном уровне
 */
export function getUpgradeCost(currentLevel: number): Resources | null {
  if (currentLevel >= MAX_ZONE_LEVEL) {
    return null;
  }
  return ZONE_UPGRADE_COSTS[currentLevel] || null;
}

/**
 * Проверить, достаточно ли ресурсов для улучшения.
 * @param zoneResources Ресурсы в пуле зоны
 * @param cost Стоимость улучшения
 * @returns true если ресурсов достаточно
 */
export function canAffordUpgrade(zoneResources: Resources, cost: Resources): boolean {
  return (
    zoneResources.energy >= cost.energy &&
    zoneResources.materials >= cost.materials &&
    zoneResources.food >= cost.food &&
    zoneResources.knowledge >= cost.knowledge
  );
}

/**
 * Вычесть стоимость из ресурсов зоны.
 * @param zoneResources Текущие ресурсы зоны
 * @param cost Стоимость для вычитания
 * @returns Новые ресурсы после вычитания
 */
export function subtractCost(zoneResources: Resources, cost: Resources): Resources {
  return {
    energy: zoneResources.energy - cost.energy,
    materials: zoneResources.materials - cost.materials,
    food: zoneResources.food - cost.food,
    knowledge: zoneResources.knowledge - cost.knowledge,
  };
}
