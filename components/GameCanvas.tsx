import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Vector2, Player, Asteroid, Particle, GameStats, GameState, Upgrade, Station 
} from '../types';
import { 
  FRICTION, SHIP_ACCEL, ROTATION_SPEED, 
  GRAVITY_CONSTANT, BLACK_HOLE_GRAVITY, BLACK_HOLE_RADIUS, EVENT_HORIZON,
  PARTICLES_PER_ASTEROID_BASE, COLORS, WORLD_WIDTH, WORLD_HEIGHT, GRID_SIZE, 
  STATION_CONSUMPTION_RATE, HIGH_DEMAND_THRESHOLD
} from '../constants';
import { playThrustSound, playGravitySound, playExplosion, playCollectSound } from '../services/audioService';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  stats: GameStats;
  setStats: React.Dispatch<React.SetStateAction<GameStats>>;
  upgrades: Upgrade[];
  playerState: React.MutableRefObject<Player>; 
  stationsRef: React.MutableRefObject<Station[]>;
  onGameEvent: (type: 'start' | 'success' | 'fail') => void;
  onDock: (station: Station) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  gameState, setGameState, stats, setStats, upgrades, playerState, stationsRef, onGameEvent, onDock 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [dockPrompt, setDockPrompt] = useState<string | null>(null);

  // Entities
  const asteroidsRef = useRef<Asteroid[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  
  // Visual Effects
  const screenShakeRef = useRef<number>(0);
  
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const blackHolePos = useRef<Vector2>({ x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 });

  // Camera & View
  const cameraRef = useRef<Vector2>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(1.0); // 1.0 = 100%
  const cameraOffsetRef = useRef<Vector2>({ x: 0, y: 0 }); // Drag offset
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<Vector2>({ x: 0, y: 0 });

  // Audio State Tracking
  const isThrustingRef = useRef<boolean>(false);
  const isGravityActiveRef = useRef<boolean>(false);

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

  // Mouse / Zoom Input Handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        // Clamp zoom between 0.2x and 3.0x
        zoomRef.current = Math.max(0.2, Math.min(3.0, zoomRef.current + delta * zoomRef.current * 2));
    };

    const handleMouseDown = (e: MouseEvent) => {
        if (e.button === 2) { // Right click
            isDraggingRef.current = true;
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDraggingRef.current) {
            const dx = e.clientX - lastMousePosRef.current.x;
            const dy = e.clientY - lastMousePosRef.current.y;
            
            // Move camera opposite to mouse drag (dragging playfield)
            // Divide by zoom to keep movement consistent with screen pixels
            cameraOffsetRef.current.x -= dx / zoomRef.current;
            cameraOffsetRef.current.y -= dy / zoomRef.current;

            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleMouseUp = (e: MouseEvent) => {
        if (e.button === 2) {
            isDraggingRef.current = false;
            canvas.style.cursor = 'default';
        }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
        canvas.removeEventListener('wheel', handleWheel);
        window.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
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

  // Init Level
  const initLevel = useCallback(() => {
    // Spawn Asteroids
    const count = 300 + stats.level * 20; 
    const newAsteroids: Asteroid[] = [];
    
    for (let i = 0; i < count; i++) {
      let pos: Vector2;
      let dist = 0;
      do {
         pos = { x: Math.random() * WORLD_WIDTH, y: Math.random() * WORLD_HEIGHT };
         const dx = pos.x - blackHolePos.current.x;
         const dy = pos.y - blackHolePos.current.y;
         dist = Math.sqrt(dx * dx + dy * dy);
      } while (dist < 800); 

      const shape: number[] = [];
      const vertices = 5 + Math.floor(Math.random() * 4);
      for(let v=0; v<vertices; v++) shape.push(0.8 + Math.random() * 0.4);

      newAsteroids.push({
        id: `ast_${i}`,
        pos,
        vel: { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
        angle: Math.random() * Math.PI * 2,
        radius: 20 + Math.random() * 40,
        mass: 10 + Math.random() * 30,
        value: 10,
        color: '#fb923c',
        shape
      });
    }
    
    asteroidsRef.current = newAsteroids;
    particlesRef.current = [];
    
    // Reset Player to safe spot near a station or random safe spot
    playerState.current.pos = { x: 2000, y: 2000 };
    playerState.current.vel = { x: 0, y: 0 }; 
    playerState.current.fuel = playerState.current.maxFuel;
    playerState.current.integrity = playerState.current.maxIntegrity;
    
    // Reset Camera
    cameraOffsetRef.current = { x: 0, y: 0 };
    zoomRef.current = 1.0;

    setStats(prev => ({ ...prev, collected: 0, particlesNeeded: count * 10 })); 
  }, [stats.level, setStats, playerState]);

  // Initial Setup
  useEffect(() => {
    if (gameState === GameState.PLAYING && asteroidsRef.current.length === 0) {
      initLevel();
    }
  }, [gameState, initLevel]);

  // Input Keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysPressed.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.code] = false; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      
      playThrustSound(false);
      playGravitySound(false);
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
    if (gameState !== GameState.PLAYING) {
        if (isThrustingRef.current) { playThrustSound(false); isThrustingRef.current = false; }
        if (isGravityActiveRef.current) { playGravitySound(false); isGravityActiveRef.current = false; }
        return;
    }

    const player = playerState.current;
    
    // 1. Player Controls
    if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft']) player.angle -= ROTATION_SPEED;
    if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight']) player.angle += ROTATION_SPEED;

    const thrustUpgrade = upgrades.find(u => u.id === 'thrusters')?.level || 1;
    const accel = SHIP_ACCEL * (1 + (thrustUpgrade * 0.2)); 

    const isThrusting = keysPressed.current['KeyW'] || keysPressed.current['ArrowUp'] || keysPressed.current['KeyS'] || keysPressed.current['ArrowDown'];
    
    if (isThrusting !== isThrustingRef.current) {
        playThrustSound(isThrusting);
        isThrustingRef.current = isThrusting;
    }

    if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp']) {
      player.vel.x += Math.cos(player.angle) * accel;
      player.vel.y += Math.sin(player.angle) * accel;
    }

    if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown']) {
      player.vel.x -= Math.cos(player.angle) * (accel * 0.5);
      player.vel.y -= Math.sin(player.angle) * (accel * 0.5);
    }

    player.singularityActive = !!keysPressed.current['Space'];

    if (player.singularityActive !== isGravityActiveRef.current) {
        playGravitySound(player.singularityActive, player.singularityStrength);
        isGravityActiveRef.current = player.singularityActive;
    }

    player.vel.x *= FRICTION;
    player.vel.y *= FRICTION;
    player.pos.x += player.vel.x;
    player.pos.y += player.vel.y;

    if (player.pos.x < 0) { player.pos.x = 0; player.vel.x *= -0.5; }
    if (player.pos.x > WORLD_WIDTH) { player.pos.x = WORLD_WIDTH; player.vel.x *= -0.5; }
    if (player.pos.y < 0) { player.pos.y = 0; player.vel.y *= -0.5; }
    if (player.pos.y > WORLD_HEIGHT) { player.pos.y = WORLD_HEIGHT; player.vel.y *= -0.5; }

    // --- Update Camera ---
    // Calculate view size in world units
    const viewW = dimensions.width / zoomRef.current;
    const viewH = dimensions.height / zoomRef.current;
    // Center on player + offset
    cameraRef.current.x = player.pos.x - viewW / 2 + cameraOffsetRef.current.x;
    cameraRef.current.y = player.pos.y - viewH / 2 + cameraOffsetRef.current.y;

    if (screenShakeRef.current > 0) {
        screenShakeRef.current *= 0.9;
        if (screenShakeRef.current < 0.5) screenShakeRef.current = 0;
    }

    // 2. Physics Entities
    const bh = blackHolePos.current;

    // --- Station Logic ---
    let nearbyStation = null;
    stationsRef.current.forEach(station => {
        station.angle += 0.002;

        // Consume Inventory (Process particles)
        if (station.inventory > 0) {
            station.inventory = Math.max(0, station.inventory - STATION_CONSUMPTION_RATE);
        }

        if (getDistance(player.pos, station.pos) < station.radius + 100) {
            nearbyStation = station;
            if (keysPressed.current['KeyF']) {
                onDock(station);
                keysPressed.current['KeyF'] = false; 
            }
        }
    });
    setDockPrompt(nearbyStation ? `PRESS 'F' TO DOCK AT ${nearbyStation.name}` : null);

    // --- Asteroids ---
    for (let i = asteroidsRef.current.length - 1; i >= 0; i--) {
      const ast = asteroidsRef.current[i];
      const distBH = getDistance(ast.pos, bh);
      
      if (distBH < EVENT_HORIZON) {
        playExplosion(ast.mass > 30 ? 'large' : 'small');
        screenShakeRef.current += ast.mass > 30 ? 15 : 5;
        if (screenShakeRef.current > 40) screenShakeRef.current = 40;

        for(let p=0; p < PARTICLES_PER_ASTEROID_BASE; p++) {
          particlesRef.current.push({
            id: `p_${Date.now()}_${p}`,
            pos: { ...ast.pos },
            vel: { x: (Math.random()-0.5)*8, y: (Math.random()-0.5)*8 },
            radius: 4,
            angle: 0,
            mass: 1,
            life: 600, 
            maxLife: 600,
            color: COLORS.PARTICLE
          });
        }
        
        setStats(prev => ({ ...prev, score: prev.score + Math.floor(ast.mass * 10) }));
        asteroidsRef.current.splice(i, 1);
        continue;
      }

      const dirBH = normalize({ x: bh.x - ast.pos.x, y: bh.y - ast.pos.y });
      const forceBH = BLACK_HOLE_GRAVITY * (2000 / (distBH * distBH + 1)); 
      ast.vel.x += dirBH.x * forceBH;
      ast.vel.y += dirBH.y * forceBH;

      if (player.singularityActive) {
        const distPlayer = getDistance(ast.pos, player.pos);
        if (distPlayer < player.singularityRadius) {
          const dirPlayer = normalize({ x: player.pos.x - ast.pos.x, y: player.pos.y - ast.pos.y });
          const singularityVirtualMass = 40; 
          const forcePlayer = (GRAVITY_CONSTANT * player.singularityStrength * singularityVirtualMass * ast.mass) / (distPlayer * distPlayer + 100);
          
          ast.vel.x += dirPlayer.x * forcePlayer;
          ast.vel.y += dirPlayer.y * forcePlayer;
          
          player.vel.x -= dirPlayer.x * (forcePlayer / player.mass) * 0.05;
          player.vel.y -= dirPlayer.y * (forcePlayer / player.mass) * 0.05;
        }
      }

      ast.vel.x *= 0.995;
      ast.vel.y *= 0.995;
      ast.pos.x += ast.vel.x;
      ast.pos.y += ast.vel.y;

      const distCol = getDistance(ast.pos, player.pos);
      if (distCol < ast.radius + player.radius) {
        const angle = Math.atan2(player.pos.y - ast.pos.y, player.pos.x - ast.pos.x);
        player.vel.x += Math.cos(angle) * 3;
        player.vel.y += Math.sin(angle) * 3;
        player.integrity -= (ast.mass * 0.1);
        screenShakeRef.current += 5;

        if (player.integrity <= 0) {
            setGameState(GameState.GAME_OVER);
            playExplosion('large');
            onGameEvent('fail');
        }
      }
    }

    // --- Particles ---
    let addedCargo = 0;
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      const distBH = getDistance(p.pos, bh);
      
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

      if (getDistance(p.pos, player.pos) < player.radius + 30) {
        if (player.cargo < player.maxCargo) {
            particlesRef.current.splice(i, 1);
            player.cargo += 1;
            addedCargo++;
            playCollectSound();
        }
      } else if (p.life <= 0) {
        particlesRef.current.splice(i, 1);
      }
    }

    if (addedCargo > 0) {
      setStats(prev => ({ ...prev, collected: prev.collected + addedCargo }));
    }

    if (getDistance(player.pos, bh) < EVENT_HORIZON) {
        player.integrity = 0;
        setGameState(GameState.GAME_OVER);
        playExplosion('large');
        onGameEvent('fail');
    }

  }, [gameState, upgrades, setGameState, setStats, onGameEvent, onDock, dimensions, playerState, stationsRef]);

  // Rendering
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const cam = cameraRef.current;
    const zoom = zoomRef.current;

    // Clear Screen
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);

    // ==========================================
    // PASS 1: WORLD SPACE (Scaled & Translated)
    // ==========================================
    ctx.save();
    
    // Apply Transform: Scale then Translate
    // Center scale adjustment isn't needed if cam is calculated as top-left of viewport
    ctx.scale(zoom, zoom);
    
    let shakeX = 0, shakeY = 0;
    if (screenShakeRef.current > 0) {
        shakeX = (Math.random() - 0.5) * screenShakeRef.current;
        shakeY = (Math.random() - 0.5) * screenShakeRef.current;
    }
    ctx.translate(-cam.x + shakeX, -cam.y + shakeY);

    // 1. Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // Calculate visible range in World Coordinates
    const startX = Math.floor(cam.x / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(cam.y / GRID_SIZE) * GRID_SIZE;
    const endX = startX + (width / zoom) + GRID_SIZE;
    const endY = startY + (height / zoom) + GRID_SIZE;

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

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // 2. Black Hole
    const bh = blackHolePos.current;
    const grd = ctx.createRadialGradient(bh.x, bh.y, EVENT_HORIZON, bh.x, bh.y, BLACK_HOLE_RADIUS * 1.5);
    grd.addColorStop(0, COLORS.BLACK_HOLE_CORE);
    grd.addColorStop(0.4, COLORS.BLACK_HOLE_DISK);
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(bh.x, bh.y, BLACK_HOLE_RADIUS * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(bh.x, bh.y, EVENT_HORIZON, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. Stations
    stationsRef.current.forEach(s => {
       // Visibility cull
       if (s.pos.x < cam.x - 250 || s.pos.x > cam.x + (width/zoom) + 250 || 
           s.pos.y < cam.y - 250 || s.pos.y > cam.y + (height/zoom) + 250) return;

       const isHighDemand = s.inventory / s.maxInventory < HIGH_DEMAND_THRESHOLD;

       ctx.save();
       ctx.translate(s.pos.x, s.pos.y);
       ctx.shadowColor = isHighDemand ? '#fbbf24' : s.color;
       ctx.shadowBlur = isHighDemand ? 60 : 40;
       
       // High Demand Pulse Ring
       if (isHighDemand) {
           const pulse = Math.sin(Date.now() * 0.01) * 10 + 20;
           ctx.strokeStyle = '#fbbf24';
           ctx.lineWidth = 2;
           ctx.globalAlpha = 0.6;
           ctx.beginPath();
           ctx.arc(0, 0, s.radius + pulse, 0, Math.PI * 2);
           ctx.stroke();
           ctx.globalAlpha = 1.0;
       }

       ctx.save();
       ctx.rotate(s.angle); 
       ctx.strokeStyle = '#475569';
       ctx.lineWidth = 8;
       for(let i=0; i<4; i++) {
           ctx.beginPath();
           ctx.moveTo(0, 0);
           ctx.lineTo(s.radius + 40, 0);
           ctx.stroke();
           ctx.fillStyle = '#1e293b';
           ctx.fillRect(s.radius, -12, 35, 24);
           ctx.strokeStyle = '#94a3b8';
           ctx.lineWidth = 1;
           ctx.strokeRect(s.radius, -12, 35, 24);
           ctx.rotate(Math.PI / 2);
       }
       ctx.restore();

       ctx.save();
       ctx.rotate(-s.angle * 1.5);
       ctx.strokeStyle = isHighDemand ? '#fbbf24' : s.color;
       ctx.lineWidth = 4;
       ctx.setLineDash([20, 15]);
       ctx.beginPath();
       ctx.arc(0, 0, s.radius + 15, 0, Math.PI * 2);
       ctx.stroke();
       ctx.setLineDash([]);
       ctx.restore();

       ctx.fillStyle = '#0f172a';
       ctx.beginPath();
       ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
       ctx.fill();
       ctx.fillStyle = isHighDemand ? '#f59e0b' : s.color;
       ctx.globalAlpha = 0.8;
       ctx.beginPath();
       ctx.arc(0, 0, s.radius * 0.6, 0, Math.PI * 2);
       ctx.fill();
       ctx.globalAlpha = 1.0;
       ctx.shadowBlur = 0;

       ctx.save();
       ctx.rotate(s.angle);
       const time = Date.now();
       for(let i=0; i<4; i++) {
           const blink = Math.sin(time * 0.005 + i) > 0;
           ctx.fillStyle = blink ? '#ef4444' : '#450a0a'; 
           ctx.beginPath();
           ctx.arc(s.radius + 45, 0, 4, 0, Math.PI * 2);
           ctx.fill();
           const blink2 = Math.cos(time * 0.008 + i) > 0.5;
           ctx.fillStyle = blink2 ? '#facc15' : '#422006'; 
           ctx.beginPath();
           ctx.arc(s.radius + 20, 15, 2, 0, Math.PI * 2);
           ctx.fill();
           ctx.rotate(Math.PI / 2);
       }
       ctx.restore();

       ctx.restore();
       
       // Draw Names in World Space but scales with zoom so text gets bigger/smaller
       ctx.fillStyle = '#fff';
       ctx.font = '16px Rajdhani';
       ctx.textAlign = 'center';
       ctx.fillText(s.name, s.pos.x, s.pos.y + s.radius + 70);
       
       if (isHighDemand) {
           ctx.fillStyle = '#fbbf24';
           ctx.font = 'bold 12px Orbitron';
           ctx.fillText('HIGH DEMAND', s.pos.x, s.pos.y + s.radius + 90);
       }
    });

    // 4. Asteroids
    asteroidsRef.current.forEach(ast => {
      // Visibility Cull
      if (ast.pos.x < cam.x - 100 || ast.pos.x > cam.x + (width/zoom) + 100 || 
          ast.pos.y < cam.y - 100 || ast.pos.y > cam.y + (height/zoom) + 100) return;

      const distBH = getDistance(ast.pos, bh);
      
      let heatFactor = 0;
      if (distBH < 600) {
        heatFactor = 1 - Math.max(0, (distBH - 200) / 400); 
      }
      
      ctx.save();
      ctx.translate(ast.pos.x, ast.pos.y);
      ctx.rotate(ast.angle);
      
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

      if (heatFactor > 0) {
        ctx.fillStyle = `rgba(255, ${200 - heatFactor * 100}, ${200 - heatFactor * 200}, ${0.2 + heatFactor * 0.5})`;
        ctx.strokeStyle = `rgb(255, ${255 - heatFactor * 50}, ${255 - heatFactor * 255})`;
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = heatFactor * 30;
        ctx.fill();
      } else {
        ctx.strokeStyle = ast.color;
      }
      
      ctx.stroke();
      ctx.restore();
    });

    // 5. Particles
    particlesRef.current.forEach(p => {
       if (p.pos.x < cam.x - 50 || p.pos.x > cam.x + (width/zoom) + 50 || 
           p.pos.y < cam.y - 50 || p.pos.y > cam.y + (height/zoom) + 50) return;
       ctx.fillStyle = p.color;
       ctx.globalAlpha = p.life / p.maxLife;
       ctx.beginPath();
       ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
       ctx.fill();
       ctx.globalAlpha = 1;
    });

    // 6. Player
    const p = playerState.current;
    ctx.save();
    ctx.translate(p.pos.x, p.pos.y);
    ctx.rotate(p.angle);
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
    
    // Engine Glow
    if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp']) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(-20, 5);
      ctx.lineTo(-25, 0);
      ctx.lineTo(-20, -5);
      ctx.fill();
    }
    // Retro Rockets
    if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown']) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(10, 2);
      ctx.lineTo(18, 4);
      ctx.lineTo(18, -4);
      ctx.lineTo(10, -2);
      ctx.fill();
    }
    ctx.restore();

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

    ctx.restore(); // END WORLD SPACE

    // ==========================================
    // PASS 2: SCREEN SPACE (UI Elements)
    // ==========================================
    // No transform here, 0,0 is top left of screen
    
    // 7. Indicators
    // We check if the SCREEN position of target is off-screen
    const drawIndicator = (targetPos: Vector2, color: string, label: string) => {
      // Convert World Pos to Screen Pos
      // ScreenX = (WorldX - CamX) * Zoom
      const screenX = (targetPos.x - cam.x) * zoom;
      const screenY = (targetPos.y - cam.y) * zoom;

      const padding = 50;

      // Check bounds
      if (screenX > padding && screenX < width - padding &&
          screenY > padding && screenY < height - padding) {
        return; // On screen
      }

      // Calculate direction from center of screen to target screen pos
      const cx = width / 2;
      const cy = height / 2;
      const dx = screenX - cx;
      const dy = screenY - cy;
      const angle = Math.atan2(dy, dx);
      
      const absCos = Math.abs(Math.cos(angle));
      const absSin = Math.abs(Math.sin(angle));
      
      const tX = (cx - padding) / (absCos || 0.001);
      const tY = (cy - padding) / (absSin || 0.001);
      
      const t = Math.min(tX, tY);
      
      const ix = cx + Math.cos(angle) * t;
      const iy = cy + Math.sin(angle) * t;

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

      ctx.fillStyle = color;
      ctx.font = '12px Rajdhani';
      ctx.textAlign = 'center';
      
      const textX = ix - Math.cos(angle) * 25;
      const textY = iy - Math.sin(angle) * 25;
      const dist = getDistance(targetPos, p.pos); // Distance in World Units
      ctx.fillText(label, textX, textY - 6);
      ctx.fillText(`${(dist/1000).toFixed(1)}km`, textX, textY + 6);
    };

    drawIndicator(bh, COLORS.BLACK_HOLE_DISK, 'SINGULARITY');
    stationsRef.current.forEach(s => drawIndicator(s.pos, s.color, s.name));

    // 8. HUD & Minimap
    if (dockPrompt) {
        ctx.font = '24px Orbitron';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(dockPrompt, width/2, height - 150);
    }
    
    // Zoom Indicator
    ctx.font = '14px Orbitron';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'left';
    ctx.fillText(`ZOOM: ${(zoom * 100).toFixed(0)}%`, 20, height - 20);

    const mapSize = 200;
    const mapScale = mapSize / WORLD_WIDTH;
    const mapX = width - mapSize - 20;
    const mapY = height - mapSize - 20;
    
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);

    // Minimap Player
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(mapX + p.pos.x * mapScale, mapY + p.pos.y * mapScale, 3, 0, Math.PI*2);
    ctx.fill();
    // Minimap BH
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(mapX + bh.x * mapScale, mapY + bh.y * mapScale, 5, 0, Math.PI*2);
    ctx.fill();
    // Minimap Stations
    stationsRef.current.forEach(s => {
        // Blink on minimap if high demand
        if (s.inventory / s.maxInventory < HIGH_DEMAND_THRESHOLD && Math.floor(Date.now() / 200) % 2 === 0) {
             ctx.fillStyle = '#fff';
        } else {
             ctx.fillStyle = s.color;
        }
        ctx.fillRect(mapX + s.pos.x * mapScale - 2, mapY + s.pos.y * mapScale - 2, 4, 4);
    });

    // Minimap Camera Viewport Rect
    // Visible world area: width/zoom, height/zoom
    const visibleWorldW = width / zoom;
    const visibleWorldH = height / zoom;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
        mapX + cam.x * mapScale,
        mapY + cam.y * mapScale,
        visibleWorldW * mapScale,
        visibleWorldH * mapScale
    );

  }, [dockPrompt, dimensions, playerState, stationsRef]);

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
      onContextMenu={(e) => e.preventDefault()}
    />
  );
};

export default GameCanvas;