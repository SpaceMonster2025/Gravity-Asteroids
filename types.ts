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
  vacuumRange: number; // Range for auto-collecting particles
  cargo: number;
  maxCargo: number;
  credits: number;
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

export interface Station extends Entity {
  name: string;
  color: string;
  priceMultiplier: number; // 1.0 is base price
  inventory: number;
  maxInventory: number;
}

export interface GameStats {
  score: number; // Represents Mass delivered to BH
  level: number;
  collected: number; // Total gathered lifetime
  particlesNeeded: number; // Quota for BH
}

export enum GameState {
  MENU,
  PLAYING,
  DOCKED,
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