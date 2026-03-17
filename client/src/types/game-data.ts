import type { ZoneName } from './game-state';

export interface GameRole {
  readonly id: number;
  readonly name: string;
  readonly archetype: string;
  readonly zone: ZoneName;
  readonly publicMission: string;
  readonly secretMotivation: string;
  readonly revealLine: string;
  readonly howToPlay?: string;
  readonly keyMoments?: string[];
  readonly relationships?: string;
}

export interface Crisis {
  readonly id: number;
  readonly zone: ZoneName;
  readonly title: string;
  readonly description: string;
  readonly question: string;
  readonly options: string[];
}

export interface Scene {
  readonly id: number;
  readonly title: string;
  readonly duration: number;
  readonly description: string;
  readonly facilitatorScript?: string;
  readonly objectives?: string[];
  readonly tips?: string[];
  readonly sampleText?: string;
}

export interface Act {
  readonly id: number;
  readonly title: string;
  readonly scenes: Scene[];
}

export interface Scenario {
  readonly acts: Act[];
}

export type EventType = 'resource_gain' | 'resource_loss' | 'dilemma' | 'narrative';

export interface EventChoice {
  readonly text: string;
  readonly result: Partial<Record<'energy' | 'materials' | 'food' | 'knowledge', number>>;
}

export interface EventEffect {
  readonly resource?: 'energy' | 'materials' | 'food' | 'knowledge' | 'all';
  readonly amount?: number;
  readonly zone?: 'center' | 'residential' | 'industrial' | 'green' | 'all';
  readonly choices?: EventChoice[];
}

export interface GameEvent {
  readonly id: number;
  readonly title: string;
  readonly description: string;
  readonly stage: number[];
  readonly type: EventType;
  readonly effect: EventEffect;
  readonly narrative: string;
  readonly facilitatorNote: string;
  readonly playerMessage: string;
}
