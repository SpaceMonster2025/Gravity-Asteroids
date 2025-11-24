import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Vector2, Player, Asteroid, Particle, GameStats, GameState, Upgrade, Station 
} from '../types';
import { 
  FRICTION, SHIP_ACCEL, ROTATION_SPEED, 
  GRAVITY_CONSTANT, BLACK_HOLE_GRAVITY, BLACK_HOLE_RADIUS, EVENT_HORIZON,
  PARTICLES_PER_ASTEROID_BASE, COLORS, WORLD_WIDTH, WORLD_HEIGHT, GRID_SIZE, STATIONS
} from '../constants';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  stats: GameStats;
  setStats: React.Dispatch<React.SetStateAction<GameStats>>;
  upgrades: Upgrade[];
  playerState: React.MutableRefObject<Player>; // Shared ref
  onGameEvent: (type: 'start' | 'success' | 'fail') => void;
  onDock: (station: Station) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  gameState, setGameState, stats, setStats, upgrades, playerState, onGameEvent, onDock 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [dockPrompt, setDockPrompt] = useState<string | null>(null);

  // Entities
  const asteroidsRef = useRef<Asteroid[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const stationsRef = useRef<Station[]>([]);
  
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const blackHolePos = useRef<Vector2>({ x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 });

  // Camera Position (Centers on player)
  const cameraRef = useRef<Vector2>({ x: 0, y: 0 });

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setDimensions({ width, height });
      if (canvasRef.current) {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Apply Upgrades
  useEffect(() => {
    const strengthUpgrade = upgrades.find(u => u.id === 'singularity_strength');
    const rangeUpgrade = upgrades.find(u => u.id === 'range');
    const hullUpgrade = upgrades.find(u => u.id === 'hull');
    const cargoUpgrade = upgrades.find(u => u.id === 'cargo');

    if (playerState.current) {
      playerState.current.singularityStrength = 1 + ((strengthUpgrade?.level || 1) - 1) * 0.5;
      playerState.current.singularityRadius = 200 + ((rangeUpgrade?.level || 1) - 1) * 50;
      playerState.current.maxIntegrity = 100 + ((hullUpgrade?.level || 1) - 1) * 25;
      playerState.current.maxCargo = 50 + ((cargoUpgrade?.level || 1) - 1) * 50;
    }
  }, [upgrades, playerState]);

  // Init World
  const initLevel = useCallback(() => {
    // Spawn Asteroids - MUCH MORE for the huge world
    const count = 300 + stats.level * 20; // 300 base
    const newAsteroids: Asteroid[] = [];
    
    for (let i = 0; i < count; i++) {
      let pos: Vector2;
      let dist = 0;
      do {
         pos = { x: Math.random() * WORLD_WIDTH, y: Math.random() * WORLD_HEIGHT };
         const dx = pos.x - blackHolePos.current.x;
         const dy = pos.y - blackHolePos.current.y;
         dist = Math.sqrt(dx * dx + dy * dy);
      } while (dist < 800); // Further spawn from BH

      // Generate shape
      const shape: number[] = [];
      const vertices = 5 + Math.floor(Math.random() * 4);
      for(let v=0; v<vertices; v++) shape.push(0.8 + Math.random() * 0.4);

      newAsteroids.push({
        id: `ast_${i}`,
        pos,
        vel: { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
        angle: Math.random() * Math.PI * 2,
        radius: 20 + Math.random() * 40, // Varied sizes
        mass: 10 + Math.random() * 30,
        value: 10,
        color: '#fb923c',
        shape
      });
    }
    
    asteroidsRef.current = newAsteroids;
    particlesRef.current = [];
    
    // Init Stations
    stationsRef.current = STATIONS.map((s, i) => ({
      ...s,
      id: `station_${i}`,
      vel: { x: 0, y: 0 },
      angle: i * (Math.PI / 3), // Varied initial angles
      mass: 10000, // Immovable
    }));

    // Reset Player to safe spot near a station or random safe spot
    playerState.current.pos = { x: 2000, y: 2000 };
    playerState.current.fuel = playerState.current.maxFuel;
    playerState.current.integrity = playerState.current.maxIntegrity;
    
    // Quota is based on MASS delivered to black hole, not particles collected
    setStats(prev => ({ ...prev, collected: 0, particlesNeeded: count * 10 })); 
  }, [stats.level, setStats, playerState]);

  // Initial Setup
  useEffect(() => {
    if (gameState === GameState.PLAYING && asteroidsRef.current.length === 0) {
      initLevel();
    }
  }, [gameState, initLevel]);

  // Input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      keysPressed.current[e.code] = true; 
      // Docking interaction handled in loop
    };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.code] = false; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const getDistance = (v1: Vector2, v2: Vector2) => {
    const dx = v1.x - v2.x;
    const dy = v1.y - v2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const normalize = (v: Vector2) => {
    const mag = Math.sqrt(v.x * v.x + v.y * v.y);
    return mag === 0 ? { x: 0, y: 0 } : { x: v.x / mag, y: v.y / mag };
  };

  // Update Loop
  const update = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;

    const player = playerState.current;
    
    // 1. Player Controls
    if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft']) player.angle -= ROTATION_SPEED;
    if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight']) player.angle += ROTATION_SPEED;

    const thrustUpgrade = upgrades.find(u => u.id === 'thrusters')?.level || 1;
    const accel = SHIP_ACCEL * (1 + (thrustUpgrade * 0.2)); 

    if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp']) {
      player.vel.x += Math.cos(player.angle) * accel;
      player.vel.y += Math.sin(player.angle) * accel;
    }

    player.singularityActive = !!keysPressed.current['Space'];

    // Friction
    player.vel.x *= FRICTION;
    player.vel.y *= FRICTION;
    player.pos.x += player.vel.x;
    player.pos.y += player.vel.y;

    // World Bounds (Bounce)
    if (player.pos.x < 0) { player.pos.x = 0; player.vel.x *= -0.5; }
    if (player.pos.x > WORLD_WIDTH) { player.pos.x = WORLD_WIDTH; player.vel.x *= -0.5; }
    if (player.pos.y < 0) { player.pos.y = 0; player.vel.y *= -0.5; }
    if (player.pos.y > WORLD_HEIGHT) { player.pos.y = WORLD_HEIGHT; player.vel.y *= -0.5; }

    // Camera Follow
    cameraRef.current.x = player.pos.x - dimensions.width / 2;
    cameraRef.current.y = player.pos.y - dimensions.height / 2;

    // 2. Physics Entities
    const bh = blackHolePos.current;

    // --- Station Logic ---
    let nearbyStation = null;
    stationsRef.current.forEach(station => {
        // Rotate stations slowly
        station.angle += 0.002;

        if (getDistance(player.pos, station.pos) < station.radius + 100) {
            nearbyStation = station;
            if (keysPressed.current['KeyF']) {
                onDock(station);
                keysPressed.current['KeyF'] = false; // Prevent spam
            }
        }
    });
    setDockPrompt(nearbyStation ? `PRESS 'F' TO DOCK AT ${nearbyStation.name}` : null);

    // --- Asteroids ---
    // Optimization: Only process asteroids relatively close to player OR close to BH
    // But for "herding" mechanics, we need global physics for anything moving.
    // For 300 items, global loop is fine.
    
    for (let i = asteroidsRef.current.length - 1; i >= 0; i--) {
      const ast = asteroidsRef.current[i];
      
      // BH Gravity
      const distBH = getDistance(ast.pos, bh);
      if (distBH < EVENT_HORIZON) {
        // Destroy & Spawn Particles
        for(let p=0; p < PARTICLES_PER_ASTEROID_BASE; p++) {
          particlesRef.current.push({
            id: `p_${Date.now()}_${p}`,
            pos: { ...ast.pos },
            vel: { x: (Math.random()-0.5)*8, y: (Math.random()-0.5)*8 },
            radius: 4,
            angle: 0,
            mass: 1,
            life: 600, // Longer life for foraging
            maxLife: 600,
            color: COLORS.PARTICLE
          });
        }
        
        // Add to Score (Mass delivered)
        setStats(prev => ({ ...prev, score: prev.score + Math.floor(ast.mass * 10) }));
        asteroidsRef.current.splice(i, 1);
        continue;
      }

      // Pull to BH
      const dirBH = normalize({ x: bh.x - ast.pos.x, y: bh.y - ast.pos.y });
      const forceBH = BLACK_HOLE_GRAVITY * (2000 / (distBH * distBH + 1)); 
      ast.vel.x += dirBH.x * forceBH;
      ast.vel.y += dirBH.y * forceBH;

      // Player Singularity
      if (player.singularityActive) {
        const distPlayer = getDistance(ast.pos, player.pos);
        if (distPlayer < player.singularityRadius) {
          const dirPlayer = normalize({ x: player.pos.x - ast.pos.x, y: player.pos.y - ast.pos.y });
          
          // Use a "Virtual Mass" for the singularity so it stays strong even if ship is light
          const singularityVirtualMass = 40; 
          const forcePlayer = (GRAVITY_CONSTANT * player.singularityStrength * singularityVirtualMass * ast.mass) / (distPlayer * distPlayer + 100);
          
          ast.vel.x += dirPlayer.x * forcePlayer;
          ast.vel.y += dirPlayer.y * forcePlayer;
          
          // Drag (Reaction Force)
          // Since player mass is now very low, we reduce the reaction coefficient significantly (0.2 -> 0.05)
          // to prevent the ship from being violently yanked into the asteroid.
          player.vel.x -= dirPlayer.x * (forcePlayer / player.mass) * 0.05;
          player.vel.y -= dirPlayer.y * (forcePlayer / player.mass) * 0.05;
        }
      }

      ast.vel.x *= 0.995;
      ast.vel.y *= 0.995;
      ast.pos.x += ast.vel.x;
      ast.pos.y += ast.vel.y;

      // Collision with Player
      const distCol = getDistance(ast.pos, player.pos);
      if (distCol < ast.radius + player.radius) {
        const angle = Math.atan2(player.pos.y - ast.pos.y, player.pos.x - ast.pos.x);
        
        // Player is knocked back
        player.vel.x += Math.cos(angle) * 3;
        player.vel.y += Math.sin(angle) * 3;
        
        // Asteroid is UNAFFECTED (Infinite mass relative to ship collision)
        // ast.vel changes removed here to prevent "bumping"
        
        player.integrity -= (ast.mass * 0.1);
        if (player.integrity <= 0) {
            setGameState(GameState.GAME_OVER);
            onGameEvent('fail');
        }
      }
    }

    // --- Particles ---
    let addedCargo = 0;
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      const distBH = getDistance(p.pos, bh);
      
      // Anti-Gravity: Push away from BH
      if (distBH < 800) {
          const dir = normalize({ x: p.pos.x - bh.x, y: p.pos.y - bh.y });
          const repulsion = 0.5 * (1 - distBH/800); 
          p.vel.x += dir.x * repulsion;
          p.vel.y += dir.y * repulsion;
      }

      p.life--;
      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;
      p.vel.x *= 0.98;
      p.vel.y *= 0.98;

      // Collection (Only if cargo space available)
      if (getDistance(p.pos, player.pos) < player.radius + 30) {
        if (player.cargo < player.maxCargo) {
            particlesRef.current.splice(i, 1);
            player.cargo += 1;
            addedCargo++;
        }
      } else if (p.life <= 0) {
        particlesRef.current.splice(i, 1);
      }
    }

    if (addedCargo > 0) {
      setStats(prev => ({ ...prev, collected: prev.collected + addedCargo }));
    }

    // BH Player Death
    if (getDistance(player.pos, bh) < EVENT_HORIZON) {
        player.integrity = 0;
        setGameState(GameState.GAME_OVER);
        onGameEvent('fail');
    }

  }, [gameState, upgrades, setGameState, setStats, onGameEvent, onDock, dimensions, playerState]);

  // Rendering
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const cam = cameraRef.current;

    // Clear Screen
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    // Apply Camera Transform
    ctx.translate(-cam.x, -cam.y);

    // 1. Draw Grid (World Background)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // Optimize grid drawing to only visible area
    const startX = Math.floor(cam.x / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(cam.y / GRID_SIZE) * GRID_SIZE;
    const endX = startX + width + GRID_SIZE;
    const endY = startY + height + GRID_SIZE;

    for (let x = startX; x <= endX; x += GRID_SIZE) {
        if (x >= 0 && x <= WORLD_WIDTH) {
            ctx.moveTo(x, startY < 0 ? 0 : startY);
            ctx.lineTo(x, endY > WORLD_HEIGHT ? WORLD_HEIGHT : endY);
        }
    }
    for (let y = startY; y <= endY; y += GRID_SIZE) {
        if (y >= 0 && y <= WORLD_HEIGHT) {
            ctx.moveTo(startX < 0 ? 0 : startX, y);
            ctx.lineTo(endX > WORLD_WIDTH ? WORLD_WIDTH : endX, y);
        }
    }
    ctx.stroke();

    // World Borders
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // 2. Draw Black Hole
    const bh = blackHolePos.current;
    // Disk
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

    // 3. Draw Stations (Enhanced Visuals)
    stationsRef.current.forEach(s => {
       // Culling
       if (s.pos.x < cam.x - 250 || s.pos.x > cam.x + width + 250 || 
           s.pos.y < cam.y - 250 || s.pos.y > cam.y + height + 250) return;

       ctx.save();
       ctx.translate(s.pos.x, s.pos.y);
       
       // Draw Glow
       ctx.shadowColor = s.color;
       ctx.shadowBlur = 40;
       
       // Rotating Outer Arms (Counter-clockwise)
       ctx.save();
       ctx.rotate(s.angle); 
       
       // Arms Structure
       ctx.strokeStyle = '#475569'; // Slate 600
       ctx.lineWidth = 8;
       for(let i=0; i<4; i++) {
           ctx.beginPath();
           ctx.moveTo(0, 0);
           ctx.lineTo(s.radius + 40, 0);
           ctx.stroke();
           
           // Panels/Blocks on arms
           ctx.fillStyle = '#1e293b'; // Slate 800
           ctx.fillRect(s.radius, -12, 35, 24);
           ctx.strokeStyle = '#94a3b8'; // Slate 400
           ctx.lineWidth = 1;
           ctx.strokeRect(s.radius, -12, 35, 24);
           
           ctx.rotate(Math.PI / 2);
       }
       ctx.restore();

       // Rotating Inner Ring (Clockwise)
       ctx.save();
       ctx.rotate(-s.angle * 1.5);
       ctx.strokeStyle = s.color;
       ctx.lineWidth = 4;
       ctx.setLineDash([20, 15]); // Dashed ring
       ctx.beginPath();
       ctx.arc(0, 0, s.radius + 15, 0, Math.PI * 2);
       ctx.stroke();
       ctx.setLineDash([]);
       ctx.restore();

       // Central Hub Body
       ctx.fillStyle = '#0f172a'; // Slate 900
       ctx.beginPath();
       ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
       ctx.fill();
       
       // Colored Core
       ctx.fillStyle = s.color;
       ctx.globalAlpha = 0.8;
       ctx.beginPath();
       ctx.arc(0, 0, s.radius * 0.6, 0, Math.PI * 2);
       ctx.fill();
       ctx.globalAlpha = 1.0;
       
       ctx.shadowBlur = 0; // Reset shadow for details

       // 4. Blinking Lights on Arms
       ctx.save();
       ctx.rotate(s.angle); // Rotate with arms
       const time = Date.now();
       for(let i=0; i<4; i++) {
           // Primary Beacon (Red)
           const blink = Math.sin(time * 0.005 + i) > 0;
           ctx.fillStyle = blink ? '#ef4444' : '#450a0a'; 
           ctx.beginPath();
           ctx.arc(s.radius + 45, 0, 4, 0, Math.PI * 2);
           ctx.fill();
           
           // Secondary Lights (Yellow)
           const blink2 = Math.cos(time * 0.008 + i) > 0.5;
           ctx.fillStyle = blink2 ? '#facc15' : '#422006'; 
           ctx.beginPath();
           ctx.arc(s.radius + 20, 15, 2, 0, Math.PI * 2);
           ctx.fill();
           
           ctx.rotate(Math.PI / 2);
       }
       ctx.restore();

       // Label
       ctx.restore(); // Restore to world coords (pop station transform)
       
       ctx.fillStyle = '#fff';
       ctx.font = '16px Rajdhani';
       ctx.textAlign = 'center';
       ctx.fillText(s.name, s.pos.x, s.pos.y + s.radius + 70);
    });

    // 4. Draw Asteroids (Culling check could be added here)
    asteroidsRef.current.forEach(ast => {
      // Simple frustum culling
      if (ast.pos.x < cam.x - 100 || ast.pos.x > cam.x + width + 100 || 
          ast.pos.y < cam.y - 100 || ast.pos.y > cam.y + height + 100) return;

      ctx.save();
      ctx.translate(ast.pos.x, ast.pos.y);
      ctx.rotate(ast.angle);
      ctx.strokeStyle = ast.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
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

    // 5. Draw Particles
    particlesRef.current.forEach(p => {
       if (p.pos.x < cam.x - 50 || p.pos.x > cam.x + width + 50 || 
           p.pos.y < cam.y - 50 || p.pos.y > cam.y + height + 50) return;
       ctx.fillStyle = p.color;
       ctx.globalAlpha = p.life / p.maxLife;
       ctx.beginPath();
       ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
       ctx.fill();
       ctx.globalAlpha = 1;
    });

    // 6. Draw Player
    const p = playerState.current;
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
    // Thruster
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

    // Singularity Ring
    if (p.singularityActive) {
        ctx.save();
        ctx.translate(p.pos.x, p.pos.y);
        ctx.strokeStyle = COLORS.SINGULARITY;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(0, 0, p.singularityRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    ctx.restore(); // End Camera Transform

    // 7. Off-screen Indicators
    const drawIndicator = (targetPos: Vector2, color: string, label: string) => {
      // Check if visible within camera bounds (with some margin)
      if (targetPos.x > cam.x + 50 && targetPos.x < cam.x + width - 50 &&
          targetPos.y > cam.y + 50 && targetPos.y < cam.y + height - 50) {
        return;
      }

      const cx = width / 2;
      const cy = height / 2;
      const dx = targetPos.x - (cam.x + cx);
      const dy = targetPos.y - (cam.y + cy);
      const angle = Math.atan2(dy, dx);
      
      const padding = 40;
      
      // Calculate intersection with screen edges
      // Line equation: x = cx + t*cos(a), y = cy + t*sin(a)
      // Screen box: [padding, width-padding], [padding, height-padding]
      
      const absCos = Math.abs(Math.cos(angle));
      const absSin = Math.abs(Math.sin(angle));
      
      const tX = (cx - padding) / (absCos || 0.001);
      const tY = (cy - padding) / (absSin || 0.001);
      
      const t = Math.min(tX, tY);
      
      const ix = cx + Math.cos(angle) * t;
      const iy = cy + Math.sin(angle) * t;

      // Draw Arrow
      ctx.fillStyle = color;
      ctx.save();
      ctx.translate(ix, iy);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-10, 10);
      ctx.lineTo(-10, -10);
      ctx.fill();
      ctx.restore();

      // Draw Label & Distance
      ctx.fillStyle = color;
      ctx.font = '12px Rajdhani';
      ctx.textAlign = 'center';
      
      // Push text slightly inward
      const textX = ix - Math.cos(angle) * 25;
      const textY = iy - Math.sin(angle) * 25;
      
      const dist = Math.sqrt(dx*dx + dy*dy);
      // Ensure text is readable
      ctx.fillText(label, textX, textY - 6);
      ctx.fillText(`${(dist/1000).toFixed(1)}km`, textX, textY + 6);
    };

    drawIndicator(bh, COLORS.BLACK_HOLE_DISK, 'SINGULARITY');
    stationsRef.current.forEach(s => drawIndicator(s.pos, s.color, s.name));

    // 8. HUD Overlays (Minimap, Prompts)
    // Dock Prompt
    if (dockPrompt) {
        ctx.font = '24px Orbitron';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(dockPrompt, width/2, height - 150);
    }

    // Minimap (Bottom Right)
    const mapSize = 200;
    const mapScale = mapSize / WORLD_WIDTH;
    const mapX = width - mapSize - 20; // Bottom Right
    const mapY = height - mapSize - 20;
    
    // Map BG
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);

    // Map Entities
    // Player
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(mapX + p.pos.x * mapScale, mapY + p.pos.y * mapScale, 3, 0, Math.PI*2);
    ctx.fill();
    // BH
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(mapX + bh.x * mapScale, mapY + bh.y * mapScale, 5, 0, Math.PI*2);
    ctx.fill();
    // Stations
    stationsRef.current.forEach(s => {
        ctx.fillStyle = s.color;
        ctx.fillRect(mapX + s.pos.x * mapScale - 2, mapY + s.pos.y * mapScale - 2, 4, 4);
    });

  }, [dockPrompt, dimensions, playerState]);

  // Loop
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