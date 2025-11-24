import { Upgrade } from './types';

// Physics Constants
export const FRICTION = 0.98;
export const SHIP_ACCEL = 0.1; // Reduced from 0.3 for heavier feel
export const SHIP_MAX_SPEED = 4; // Reduced from 8 to make upgrades meaningful
export const ROTATION_SPEED = 0.08; // Slightly slower turning
export const GRAVITY_CONSTANT = 0.5;
export const BLACK_HOLE_GRAVITY = 0.8;
export const BLACK_HOLE_RADIUS = 60;
export const EVENT_HORIZON = 25;

// Gameplay Constants
export const PARTICLES_PER_ASTEROID_BASE = 5;
export const FUEL_CONSUMPTION = 0.1;
export const FUEL_REGEN = 0.05;

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
};

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
  }
];