import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Vector2, Entity, Player, Asteroid, Particle, GameStats, GameState, Upgrade 
} from '../types';
import { 
  FRICTION, SHIP_ACCEL, ROTATION_SPEED, 
  GRAVITY_CONSTANT, BLACK_HOLE_GRAVITY, BLACK_HOLE_RADIUS, EVENT_HORIZON,
  PARTICLES_PER_ASTEROID_BASE, COLORS
} from '../constants';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  stats: GameStats;
  setStats: React.Dispatch<React.SetStateAction<GameStats>>;
  upgrades: Upgrade[];
  onGameEvent: (type: 'start' | 'success' | 'fail') => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  gameState, setGameState, stats, setStats, upgrades, onGameEvent 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  
  // Track screen dimensions for full screen support
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Game State Refs (Mutable for loop performance)
  const playerRef = useRef<Player>({
    id: 'player',
    pos: { x: window.innerWidth / 2, y: window.innerHeight / 4 },
    vel: { x: 0, y: 0 },
    angle: 0,
    radius: 15,
    mass: 20,
    fuel: 100,
    maxFuel: 100,
    integrity: 100,
    maxIntegrity: 100,
    singularityActive: false,
    singularityRadius: 200,
    singularityStrength: 1
  });

  const asteroidsRef = useRef<Asteroid[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const blackHolePos = useRef<Vector2>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setDimensions({ width, height });
      
      // Update canvas resolution immediately to avoid stretching
      if (canvasRef.current) {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }

      // Recenter Black Hole
      blackHolePos.current = { x: width / 2, y: height / 2 };
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Apply Upgrades to Player Refs
  useEffect(() => {
    const strengthUpgrade = upgrades.find(u => u.id === 'singularity_strength');
    const rangeUpgrade = upgrades.find(u => u.id === 'range');
    const hullUpgrade = upgrades.find(u => u.id === 'hull');

    if (playerRef.current) {
      playerRef.current.singularityStrength = 1 + ((strengthUpgrade?.level || 1) - 1) * 0.5;
      playerRef.current.singularityRadius = 200 + ((rangeUpgrade?.level || 1) - 1) * 50;
      playerRef.current.maxIntegrity = 100 + ((hullUpgrade?.level || 1) - 1) * 25;
    }
  }, [upgrades]);

  // Level Initialization
  const initLevel = useCallback(() => {
    if (!canvasRef.current) return;
    
    // Spawn Asteroids based on level
    const count = 5 + stats.level * 2;
    const newAsteroids: Asteroid[] = [];
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    for (let i = 0; i < count; i++) {
      // Spawn away from black hole
      let pos: Vector2;
      let dist = 0;
      do {
         pos = { x: Math.random() * width, y: Math.random() * height };
         const dx = pos.x - blackHolePos.current.x;
         const dy = pos.y - blackHolePos.current.y;
         dist = Math.sqrt(dx * dx + dy * dy);
      } while (dist < 300); // Safe spawn distance

      // Generate random polygon shape
      const shape: number[] = [];
      const vertices = 5 + Math.floor(Math.random() * 4);
      for(let v=0; v<vertices; v++) {
          shape.push(0.8 + Math.random() * 0.4); // Scale factor for radius
      }

      newAsteroids.push({
        id: `ast_${i}`,
        pos,
        vel: { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
        angle: Math.random() * Math.PI * 2,
        radius: 15 + Math.random() * 25,
        mass: 10 + Math.random() * 20,
        value: 10,
        color: '#fb923c',
        shape
      });
    }
    
    asteroidsRef.current = newAsteroids;
    particlesRef.current = [];
    
    // Reset Player Fuel/Health slightly?
    playerRef.current.fuel = playerRef.current.maxFuel;
    
    setStats(prev => ({ ...prev, collected: 0, particlesNeeded: count * PARTICLES_PER_ASTEROID_BASE }));
  }, [stats.level, setStats]);

  // Initial Setup
  useEffect(() => {
    if (gameState === GameState.PLAYING && asteroidsRef.current.length === 0) {
      initLevel();
    }
  }, [gameState, initLevel]);

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysPressed.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.code] = false; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Physics Helpers
  const getDistance = (v1: Vector2, v2: Vector2) => {
    const dx = v1.x - v2.x;
    const dy = v1.y - v2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const normalize = (v: Vector2) => {
    const mag = Math.sqrt(v.x * v.x + v.y * v.y);
    return mag === 0 ? { x: 0, y: 0 } : { x: v.x / mag, y: v.y / mag };
  };

  // Main Game Loop
  const update = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const player = playerRef.current;
    
    // --- Player Movement ---
    if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft']) player.angle -= ROTATION_SPEED;
    if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight']) player.angle += ROTATION_SPEED;

    const thrustUpgrade = upgrades.find(u => u.id === 'thrusters')?.level || 1;
    const accel = SHIP_ACCEL * (1 + (thrustUpgrade * 0.2)); 
    // Reduced base speed means upgrades need slightly higher multiplier to feel punchy

    if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp']) {
      player.vel.x += Math.cos(player.angle) * accel;
      player.vel.y += Math.sin(player.angle) * accel;
    }

    // Singularity Activation
    player.singularityActive = !!keysPressed.current['Space'];

    // Apply Friction
    player.vel.x *= FRICTION;
    player.vel.y *= FRICTION;
    player.pos.x += player.vel.x;
    player.pos.y += player.vel.y;

    // Boundary Wrap using current window dimensions
    if (player.pos.x < 0) player.pos.x = width;
    if (player.pos.x > width) player.pos.x = 0;
    if (player.pos.y < 0) player.pos.y = height;
    if (player.pos.y > height) player.pos.y = 0;

    // --- Physics Entities ---
    const bh = blackHolePos.current;

    // Asteroids
    for (let i = asteroidsRef.current.length - 1; i >= 0; i--) {
      const ast = asteroidsRef.current[i];
      
      // 1. Gravity from Black Hole
      const distBH = getDistance(ast.pos, bh);
      if (distBH < EVENT_HORIZON) {
        // Destroy Asteroid & Spawn Particles
        for(let p=0; p < PARTICLES_PER_ASTEROID_BASE; p++) {
          particlesRef.current.push({
            id: `p_${Date.now()}_${p}`,
            pos: { ...ast.pos },
            vel: { 
              x: (Math.random() - 0.5) * 5, 
              y: (Math.random() - 0.5) * 5 
            },
            radius: 3,
            angle: 0,
            mass: 1,
            life: 150 + Math.random() * 50,
            maxLife: 200,
            color: COLORS.PARTICLE
          });
        }
        asteroidsRef.current.splice(i, 1);
        continue;
      }

      // Pull into BH
      const dirBH = normalize({ x: bh.x - ast.pos.x, y: bh.y - ast.pos.y });
      const forceBH = BLACK_HOLE_GRAVITY * (1000 / (distBH * distBH + 1)); // Clamped gravity
      ast.vel.x += dirBH.x * forceBH;
      ast.vel.y += dirBH.y * forceBH;

      // 2. Singularity Pull (Player)
      if (player.singularityActive) {
        const distPlayer = getDistance(ast.pos, player.pos);
        if (distPlayer < player.singularityRadius) {
          const dirPlayer = normalize({ x: player.pos.x - ast.pos.x, y: player.pos.y - ast.pos.y });
          const forcePlayer = (GRAVITY_CONSTANT * player.singularityStrength * player.mass * ast.mass) / (distPlayer * distPlayer + 100);
          
          // Pull Asteroid
          ast.vel.x += dirPlayer.x * forcePlayer;
          ast.vel.y += dirPlayer.y * forcePlayer;

          // Drag on Ship (Newton's 3rd Lawish - reduced for gameplay fun)
          player.vel.x -= dirPlayer.x * (forcePlayer / player.mass) * 0.5;
          player.vel.y -= dirPlayer.y * (forcePlayer / player.mass) * 0.5;
        }
      }

      // Move Asteroid
      ast.vel.x *= 0.99; // Space drag
      ast.vel.y *= 0.99;
      ast.pos.x += ast.vel.x;
      ast.pos.y += ast.vel.y;

      // Player Collision (Damage)
      const distCol = getDistance(ast.pos, player.pos);
      if (distCol < ast.radius + player.radius) {
        // Bounce
        const angle = Math.atan2(player.pos.y - ast.pos.y, player.pos.x - ast.pos.x);
        player.vel.x += Math.cos(angle) * 2;
        player.vel.y += Math.sin(angle) * 2;
        ast.vel.x -= Math.cos(angle) * 1;
        ast.vel.y -= Math.sin(angle) * 1;
        
        player.integrity -= (ast.mass * 0.5);
        if (player.integrity <= 0) {
            setGameState(GameState.GAME_OVER);
            onGameEvent('fail');
        }
      }
    }

    // Particles
    let particlesCollected = 0;
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];

      // Anti-Gravity: Exotic particles are repelled by the Black Hole
      const distBH = getDistance(p.pos, bh);
      if (distBH < 400) {
          const dir = normalize({ x: p.pos.x - bh.x, y: p.pos.y - bh.y });
          // Repulsion force ensures they drift out of the danger zone
          const repulsion = 0.4; 
          p.vel.x += dir.x * repulsion;
          p.vel.y += dir.y * repulsion;
      }

      p.life--;
      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;
      p.vel.x *= 0.95;
      p.vel.y *= 0.95;

      // Collection
      if (getDistance(p.pos, player.pos) < player.radius + 20) {
        particlesRef.current.splice(i, 1);
        particlesCollected++;
      } else if (p.life <= 0) {
        particlesRef.current.splice(i, 1);
      }
    }

    if (particlesCollected > 0) {
      setStats(prev => {
         const newCollected = prev.collected + particlesCollected;
         const newScore = prev.score + (particlesCollected * 10);
         
         // Level Complete Check
         if (newCollected >= prev.particlesNeeded && asteroidsRef.current.length === 0) {
             // Delay slightly to prevent instant transition or handle via effect
             setTimeout(() => {
               setGameState(GameState.LEVEL_COMPLETE);
               onGameEvent('success');
             }, 100);
         }
         return { ...prev, collected: newCollected, score: newScore };
      });
    }

    // Black Hole Threat to Player
    const distPlayerBH = getDistance(player.pos, bh);
    if (distPlayerBH < EVENT_HORIZON) {
        player.integrity = 0;
        setGameState(GameState.GAME_OVER);
        onGameEvent('fail');
    }

  }, [gameState, upgrades, setGameState, setStats, onGameEvent]);

  // Rendering
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Use stored dimensions or current canvas dimensions
    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);

    // Draw Black Hole
    const bh = blackHolePos.current;
    
    // Accretion Disk
    const grd = ctx.createRadialGradient(bh.x, bh.y, EVENT_HORIZON, bh.x, bh.y, BLACK_HOLE_RADIUS * 1.5);
    grd.addColorStop(0, COLORS.BLACK_HOLE_CORE);
    grd.addColorStop(0.4, COLORS.BLACK_HOLE_DISK);
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(bh.x, bh.y, BLACK_HOLE_RADIUS * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Event Horizon
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(bh.x, bh.y, EVENT_HORIZON, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Asteroids
    asteroidsRef.current.forEach(ast => {
      ctx.save();
      ctx.translate(ast.pos.x, ast.pos.y);
      ctx.rotate(ast.angle);
      ctx.strokeStyle = ast.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Draw irregular polygon
      ast.shape.forEach((scale, idx) => {
        const theta = (idx / ast.shape.length) * Math.PI * 2;
        const x = Math.cos(theta) * ast.radius * scale;
        const y = Math.sin(theta) * ast.radius * scale;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    });

    // Draw Particles
    particlesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Draw Player
    const p = playerRef.current;
    ctx.save();
    ctx.translate(p.pos.x, p.pos.y);
    ctx.rotate(p.angle);
    
    // Ship Body
    ctx.strokeStyle = COLORS.SHIP;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.SHIP_GLOW;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-10, 10);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, -10);
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Thruster Flame
    if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp']) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(-20, 5);
      ctx.lineTo(-25, 0);
      ctx.lineTo(-20, -5);
      ctx.fill();
    }
    ctx.restore();

    // Singularity Effect
    if (p.singularityActive) {
        ctx.save();
        ctx.translate(p.pos.x, p.pos.y);
        ctx.strokeStyle = COLORS.SINGULARITY;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(0, 0, p.singularityRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Pulse
        const pulseSize = (Date.now() % 500) / 500 * p.singularityRadius;
        ctx.beginPath();
        ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

  }, []);

  // Loop Driver
  const loop = useCallback(() => {
    update();
    draw();
    requestRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  return (
    <canvas 
      ref={canvasRef} 
      width={dimensions.width} 
      height={dimensions.height}
      className="block absolute top-0 left-0 z-0"
    />
  );
};

export default GameCanvas;