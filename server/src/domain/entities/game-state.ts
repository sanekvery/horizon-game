export interface Resources {
  readonly energy: number;
  readonly materials: number;
  readonly food: number;
  readonly knowledge: number;
}

export interface Zone {
  readonly level: number;
  readonly resources: Resources;
}

export interface UnknownZone {
  readonly revealed: boolean;
}

export interface Zones {
  readonly center: Zone;
  readonly residential: Zone;
  readonly industrial: Zone;
  readonly green: Zone;
  readonly unknown: UnknownZone;
}

export interface PlayerResources {
  readonly energy: number;
  readonly materials: number;
  readonly food: number;
  readonly knowledge: number;
}

export interface Role {
  readonly id: number;
  readonly token: string;
  readonly name: string;
  readonly connected: boolean;
  readonly secretRevealed: boolean;
  readonly promise: string | null;
  readonly resources: PlayerResources;
}

export interface VoteOption {
  readonly id: string;
  readonly text: string;
}

export interface Vote {
  readonly id: string;
  readonly question: string;
  readonly options: VoteOption[];
  readonly results: Record<string, number>;
  readonly status: 'pending' | 'active' | 'closed';
}

export interface Timer {
  readonly running: boolean;
  readonly remainingSec: number;
}

export interface Promise {
  readonly roleId: number;
  readonly text: string;
  readonly deadline: string;
}

export interface GameState {
  readonly sessionId: string;
  readonly currentAct: 1 | 2 | 3 | 4 | 5;
  readonly currentScene: number;
  readonly timer: Timer;
  readonly zones: Zones;
  readonly roles: Role[];
  readonly votes: Vote[];
  readonly candlesLit: number[];
  readonly fogRevealed: boolean;
  readonly promises: Promise[];
}

export type ZoneName = 'center' | 'residential' | 'industrial' | 'green' | 'unknown';
export type ResourceName = 'energy' | 'materials' | 'food' | 'knowledge';
