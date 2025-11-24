export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  pos: Vector2;
  vel: Vector2;
  radius: number;
  angle: number;
  mass: number;
}

export interface Player extends Entity {
  fuel: number;
  maxFuel: number;
  integrity: number;
  maxIntegrity: number;
  singularityActive: boolean;
  singularityRadius: number;
  singularityStrength: number;
}

export interface Asteroid extends Entity {
  value: number;
  color: string;
  shape: number[]; // Array of offsets for polygon drawing
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  color: string;
}

export interface GameStats {
  score: number;
  level: number;
  collected: number;
  particlesNeeded: number;
}

export enum GameState {
  MENU,
  PLAYING,
  LEVEL_COMPLETE,
  GAME_OVER
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  level: number;
  maxLevel: number;
}

export interface NarrativeLog {
  sender: string;
  message: string;
  timestamp: string;
}