import { Upgrade, Station } from './types';

// World Constants
export const WORLD_WIDTH = 10000;
export const WORLD_HEIGHT = 10000;
export const GRID_SIZE = 2000; // Much larger grid (sparser lines)

// Physics Constants
export const FRICTION = 0.98;
export const SHIP_ACCEL = 0.1;
export const SHIP_MAX_SPEED = 4;
export const ROTATION_SPEED = 0.08;
export const GRAVITY_CONSTANT = 0.5;
export const BLACK_HOLE_GRAVITY = 0.8;
export const BLACK_HOLE_RADIUS = 150; // Larger for bigger map
export const EVENT_HORIZON = 50;

// Gameplay Constants
export const PARTICLES_PER_ASTEROID_BASE = 5;
export const FUEL_CONSUMPTION = 0.05;
export const PARTICLE_BASE_PRICE = 10;
export const FUEL_COST = 1; // Per unit
export const REPAIR_COST = 5; // Per unit

// Colors
export const COLORS = {
  SHIP: '#06b6d4', // Cyan 500
  SHIP_GLOW: '#22d3ee',
  SINGULARITY: '#d946ef', // Fuchsia 500
  SINGULARITY_ACTIVE: '#f0abfc',
  BLACK_HOLE_CORE: '#000000',
  BLACK_HOLE_DISK: '#f59e0b', // Amber 500
  PARTICLE: '#a5f3fc', // Cyan 200
  TEXT_HOLO: '#22d3ee',
  WARNING: '#ef4444',
  STATION: '#10b981', // Emerald 500
  STATION_GLOW: '#34d399',
};

export const STATIONS: Omit<Station, 'id' | 'vel' | 'angle' | 'mass'>[] = [
  {
    name: 'Alpha Outpost',
    pos: { x: 1500, y: 1500 },
    radius: 100,
    color: '#10b981',
    priceMultiplier: 1.0, // Safer, lower price
  },
  {
    name: 'Beta Refinery',
    pos: { x: 8500, y: 2000 },
    radius: 100,
    color: '#3b82f6', // Blue
    priceMultiplier: 1.2,
  },
  {
    name: 'Void Bazaar',
    pos: { x: 5000, y: 8500 }, // Deep space
    radius: 120,
    color: '#8b5cf6', // Violet
    priceMultiplier: 1.5, // High risk/reward
  }
];

export const INITIAL_UPGRADES: Upgrade[] = [
  {
    id: 'singularity_strength',
    name: 'Event Horizon Amplifier',
    description: 'Increases the gravitational pull force of your singularity.',
    cost: 100,
    level: 1,
    maxLevel: 5
  },
  {
    id: 'thrusters',
    name: 'Ion Drive Overclock',
    description: 'Improves ship acceleration and max speed.',
    cost: 80,
    level: 1,
    maxLevel: 5
  },
  {
    id: 'hull',
    name: 'Nanocarbon Plating',
    description: 'Increases ship structural integrity.',
    cost: 150,
    level: 1,
    maxLevel: 5
  },
  {
    id: 'range',
    name: 'Graviton Lens',
    description: 'Expands the effective radius of your singularity.',
    cost: 120,
    level: 1,
    maxLevel: 5
  },
  {
    id: 'cargo',
    name: 'Compression Hold',
    description: 'Increases maximum particle storage capacity.',
    cost: 200,
    level: 1,
    maxLevel: 5
  }
];