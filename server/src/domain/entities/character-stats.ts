/**
 * Character Stats Value Object
 *
 * Represents the six core attributes of a character.
 * Immutable - all modifications return new instances.
 */

export type StatName =
  | 'strength'
  | 'agility'
  | 'negotiation'
  | 'intellect'
  | 'charisma'
  | 'craft'
  | 'luck'
  | 'endurance'
  | 'leadership'
  | 'perception';

export interface CharacterStatsData {
  readonly strength: number;
  readonly agility: number;
  readonly negotiation: number;
  readonly intellect: number;
  readonly charisma: number;
  readonly craft: number;
  readonly luck: number;
  readonly endurance: number;
  readonly leadership: number;
  readonly perception: number;
}

export const STAT_NAMES_RU: Record<StatName, string> = {
  strength: 'Сила',
  agility: 'Ловкость',
  negotiation: 'Переговоры',
  intellect: 'Интеллект',
  charisma: 'Харизма',
  craft: 'Мастерство',
  luck: 'Удача',
  endurance: 'Выносливость',
  leadership: 'Лидерство',
  perception: 'Восприятие',
};

export const STAT_ICONS: Record<StatName, string> = {
  strength: '⚔️',
  agility: '🏃',
  negotiation: '🗣️',
  intellect: '🧠',
  charisma: '💎',
  craft: '🔧',
  luck: '🍀',
  endurance: '🛡️',
  leadership: '👑',
  perception: '👁️',
};

export const STAT_DESCRIPTIONS: Record<StatName, string> = {
  strength: 'Защита от урона событий (5% за уровень)',
  agility: 'Скорость действий (+5% за уровень выше 5)',
  negotiation: 'Бонус торговли (+2% за уровень)',
  intellect: 'Шанс открытий (10% за уровень)',
  charisma: 'Вес голоса (+0.1 за уровень выше 5)',
  craft: 'Эффективность ресурсов (+5% за уровень)',
  luck: 'Шанс критического успеха (3% за уровень)',
  endurance: 'Сопротивление негативу, +1 действие за каждые 5 уровней',
  leadership: 'Бонус команде (+1% всем за каждые 3 уровня)',
  perception: 'Обнаружение скрытого (8% за уровень), предупреждения',
};

export const DEFAULT_STAT_VALUE = 5;
export const MIN_STAT_VALUE = 1;
export const MAX_STAT_VALUE_BASE = 10;
export const MAX_STAT_VALUE_WITH_PROGRESSION = 15;

export class CharacterStats {
  private constructor(private readonly data: CharacterStatsData) {
    this.validate();
  }

  static create(data?: Partial<CharacterStatsData>): CharacterStats {
    return new CharacterStats({
      strength: data?.strength ?? DEFAULT_STAT_VALUE,
      agility: data?.agility ?? DEFAULT_STAT_VALUE,
      negotiation: data?.negotiation ?? DEFAULT_STAT_VALUE,
      intellect: data?.intellect ?? DEFAULT_STAT_VALUE,
      charisma: data?.charisma ?? DEFAULT_STAT_VALUE,
      craft: data?.craft ?? DEFAULT_STAT_VALUE,
      luck: data?.luck ?? DEFAULT_STAT_VALUE,
      endurance: data?.endurance ?? DEFAULT_STAT_VALUE,
      leadership: data?.leadership ?? DEFAULT_STAT_VALUE,
      perception: data?.perception ?? DEFAULT_STAT_VALUE,
    });
  }

  static createDefault(): CharacterStats {
    return CharacterStats.create();
  }

  static fromJSON(json: string | CharacterStatsData): CharacterStats {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    return CharacterStats.create(data);
  }

  private validate(): void {
    const stats: StatName[] = [
      'strength', 'agility', 'negotiation', 'intellect', 'charisma', 'craft',
      'luck', 'endurance', 'leadership', 'perception'
    ];
    for (const stat of stats) {
      const value = this.data[stat];
      if (value < MIN_STAT_VALUE || value > MAX_STAT_VALUE_WITH_PROGRESSION) {
        throw new Error(`Invalid ${stat} value: ${value}. Must be between ${MIN_STAT_VALUE} and ${MAX_STAT_VALUE_WITH_PROGRESSION}`);
      }
    }
  }

  get strength(): number {
    return this.data.strength;
  }

  get agility(): number {
    return this.data.agility;
  }

  get negotiation(): number {
    return this.data.negotiation;
  }

  get intellect(): number {
    return this.data.intellect;
  }

  get charisma(): number {
    return this.data.charisma;
  }

  get craft(): number {
    return this.data.craft;
  }

  get luck(): number {
    return this.data.luck;
  }

  get endurance(): number {
    return this.data.endurance;
  }

  get leadership(): number {
    return this.data.leadership;
  }

  get perception(): number {
    return this.data.perception;
  }

  getStat(name: StatName): number {
    return this.data[name];
  }

  /**
   * Returns total points allocated across all stats
   */
  getTotalPoints(): number {
    return (
      this.strength +
      this.agility +
      this.negotiation +
      this.intellect +
      this.charisma +
      this.craft +
      this.luck +
      this.endurance +
      this.leadership +
      this.perception
    );
  }

  /**
   * Creates a new CharacterStats with one stat increased
   */
  withIncreasedStat(name: StatName, amount: number = 1, maxValue: number = MAX_STAT_VALUE_WITH_PROGRESSION): CharacterStats {
    const currentValue = this.data[name];
    const newValue = Math.min(currentValue + amount, maxValue);

    return new CharacterStats({
      ...this.data,
      [name]: newValue,
    });
  }

  /**
   * Creates a new CharacterStats with one stat decreased
   */
  withDecreasedStat(name: StatName, amount: number = 1): CharacterStats {
    const currentValue = this.data[name];
    const newValue = Math.max(currentValue - amount, MIN_STAT_VALUE);

    return new CharacterStats({
      ...this.data,
      [name]: newValue,
    });
  }

  /**
   * Check if stat can be increased
   */
  canIncrease(name: StatName, maxValue: number = MAX_STAT_VALUE_WITH_PROGRESSION): boolean {
    return this.data[name] < maxValue;
  }

  /**
   * Check if stat can be decreased
   */
  canDecrease(name: StatName): boolean {
    return this.data[name] > MIN_STAT_VALUE;
  }

  toJSON(): CharacterStatsData {
    return { ...this.data };
  }

  toString(): string {
    return JSON.stringify(this.data);
  }

  equals(other: CharacterStats): boolean {
    return (
      this.strength === other.strength &&
      this.agility === other.agility &&
      this.negotiation === other.negotiation &&
      this.intellect === other.intellect &&
      this.charisma === other.charisma &&
      this.craft === other.craft &&
      this.luck === other.luck &&
      this.endurance === other.endurance &&
      this.leadership === other.leadership &&
      this.perception === other.perception
    );
  }
}
