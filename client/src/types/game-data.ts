import type { ZoneName } from './game-state';

export interface GameRole {
  readonly id: number;
  readonly name: string;
  readonly archetype: string;
  readonly zone: ZoneName;
  readonly publicMission: string;
  readonly secretMotivation: string;
  readonly revealLine: string;
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
}

export interface Act {
  readonly id: number;
  readonly title: string;
  readonly scenes: Scene[];
}

export interface Scenario {
  readonly acts: Act[];
}
