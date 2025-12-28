
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameConfig, Ball, Vector2 } from '../types';
import { add, sub, mult, dot, normalize, rotatePoint, distToSegment, mag, distSq, dist } from '../utils/math';
import { t } from '../utils/translations';

interface GameCanvasProps {
  config: GameConfig;
  paused: boolean;
  restartTrigger: number;
  setTotalCollisions: (n: number) => void;
}

const COLORS = [
  '#00ffff', // Cyan
  '#ff00ff', // Magenta
  '#ffff00', // Yellow
  '#00ff00', // Lime
  '#ff4500', // OrangeRed
  '#39ff14', // Neon Green
  '#fe019a', // Neon Pink
  '#bc13fe', // Neon Purple
];

const SUB_STEPS = 10; // Increased for better collision precision

type DragState = 
  | { type: 'BALL'; id: number; offset: Vector2 } 
  | { type: 'VELOCITY'; id: number } 
  | null;

export const GameCanvas: React.FC<GameCanvasProps> = ({ config, paused, restartTrigger, setTotalCollisions }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [balls, setBalls] = useState<Ball[]>([]);
  const requestRef = useRef<number>(0);
  const rotationRef = useRef<number>(0);
  
  // Collision Tracking
  const collisionCountRef = useRef<number>(0);

  // Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  
  // Track manually removed walls: "layerIndex-sideIndex"
  const manualGapsRef = useRef<Set<string>>(new Set());
  
  // Interaction State
  const dragStateRef = useRef<DragState>(null);
  const mousePosRef = useRef<Vector2>({ x: 0, y: 0 });
  const hoveredWallRef = useRef<string | null>(null);

  // Long Press State
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartPosRef = useRef<Vector2 | null>(null);

  // We keep a mutable reference to balls for the animation loop
  const ballsRef = useRef<Ball[]>([]);

  // Initialize Audio Context for Sound Effects
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
    }
    return () => {
        audioCtxRef.current?.close();
    };
  }, []);

  // Sync Collision Count to Parent
  useEffect(() => {
    const interval = setInterval(() => {
        setTotalCollisions(collisionCountRef.current);
    }, 100);
    return () => clearInterval(interval);
  }, [setTotalCollisions]);

  // Initialize Microphone
  useEffect(() => {
    if (config.micControlEnabled && !micStreamRef.current && audioCtxRef.current) {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                micStreamRef.current = stream;
                const ctx = audioCtxRef.current!;
                const source = ctx.createMediaStreamSource(stream);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                micAnalyserRef.current = analyser;
            })
            .catch(err => {
                console.error("Microphone access denied:", err);
            });
    } else if (!config.micControlEnabled && micStreamRef.current) {
        // Cleanup mic if disabled
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
        micAnalyserRef.current = null;
    }
  }, [config.micControlEnabled]);

  const playBounceSound = useCallback((intensity: number) => {
      if (!config.soundEnabled || !audioCtxRef.current) return;
      
      if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
      }

      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      const baseFreq = 150 + Math.random() * 200 + (intensity * 5);
      const now = ctx.currentTime;
      
      switch (config.soundScheme) {
          case 'synth': {
              const modulator = ctx.createOscillator();
              const modGain = ctx.createGain();
              modulator.type = 'sawtooth';
              modulator.frequency.value = baseFreq * 2.5;
              modulator.connect(modGain);
              modGain.connect(osc.frequency);
              modGain.gain.setValueAtTime(100, now);
              modGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
              modulator.start();
              modulator.stop(now + 0.2);
              osc.type = 'sine';
              break;
          }
          case 'bell': {
             osc.type = 'sine';
             const harmonic = ctx.createOscillator();
             const hGain = ctx.createGain();
             harmonic.type = 'triangle';
             harmonic.frequency.value = baseFreq * 3.5;
             harmonic.connect(hGain);
             hGain.connect(ctx.destination);
             hGain.gain.setValueAtTime(0.1, now);
             hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
             harmonic.start();
             harmonic.stop(now + 0.4);
             break;
          }
          case 'glitch': {
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(baseFreq, now);
              osc.frequency.linearRampToValueAtTime(baseFreq * (Math.random() > 0.5 ? 2 : 0.5), now + 0.05);
              gainNode.gain.setValueAtTime(0.1, now);
              gainNode.gain.linearRampToValueAtTime(0, now + 0.05);
              osc.start();
              osc.stop(now + 0.05);
              return; // Exit as we handled start/stop
          }
          default:
              osc.type = config.soundScheme as any;
      }

      osc.frequency.setValueAtTime(baseFreq, now);
      if (config.soundScheme !== 'bell') {
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.15);
      }

      const volume = Math.min(0.4, intensity * 0.04);
      gainNode.gain.setValueAtTime(volume, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + (config.soundScheme === 'bell' ? 0.5 : 0.15));

      osc.start();
      osc.stop(now + (config.soundScheme === 'bell' ? 0.5 : 0.15));
  }, [config.soundEnabled, config.soundScheme]);

  // Initialize Balls
  const initBalls = useCallback(() => {
    const newBalls: Ball[] = [];
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const maxRadius = Math.min(window.innerWidth, window.innerHeight) * 0.45 * config.baseScale;
    
    // Reset collisions on restart
    collisionCountRef.current = 0;

    for (let i = 0; i < config.ballCount; i++) {
      let pos, vel, radius, color;

      if (config.randomSpawn) {
          // Chaos Spawn Mode
          const maxDim = Math.min(window.innerWidth, window.innerHeight) * 0.4 * config.baseScale;
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * maxDim; // Random distance from center
          pos = {
              x: centerX + Math.cos(angle) * r,
              y: centerY + Math.sin(angle) * r
          };
          vel = {
              x: (Math.random() - 0.5) * 20,
              y: (Math.random() - 0.5) * 20
          };
          radius = 3 + Math.random() * 15;
          // Fully random color
          color = `hsl(${Math.random() * 360}, 80%, 60%)`;
      } else {
          // Standard Spawn Mode
          if (config.micControlEnabled) {
              // Start at bottom if mic control
              pos = { x: centerX + (Math.random() - 0.5) * 100, y: centerY + maxRadius - 20 - (Math.random() * 50) };
              vel = { x: 0, y: 0 };
          } else {
              const randomOffsetX = (Math.random() - 0.5) * 50;
              const randomOffsetY = (Math.random() - 0.5) * 50;
              pos = { 
                x: centerX + (config.spawnPos.x * 300) + randomOffsetX, 
                y: centerY + (config.spawnPos.y * 300) + randomOffsetY 
              };
              vel = { 
                x: (Math.random() - 0.5) * 10, 
                y: (Math.random() - 0.5) * 10 
              };
          }
          radius = config.ballSize + Math.random() * 2;
          color = COLORS[i % COLORS.length];
      }
      
      newBalls.push({
        id: i,
        pos,
        vel,
        radius,
        color,
        trail: [],
        isPinned: false
      });
    }
    ballsRef.current = newBalls;
    setBalls(newBalls); 
    manualGapsRef.current.clear(); // Clear manual gaps on full restart
  }, [config.ballCount, config.spawnPos, config.ballSize, config.randomSpawn, config.baseScale, config.micControlEnabled]);

  // Update existing ball sizes when slider changes (if not in chaos mode)
  useEffect(() => {
      if (!config.randomSpawn) {
          ballsRef.current.forEach(ball => {
              ball.radius = config.ballSize + (Math.random() * 2);
          });
      }
  }, [config.ballSize, config.randomSpawn]);

  useEffect(() => {
    initBalls();
  }, [initBalls, restartTrigger]);

  // --- Interaction Handlers ---

  const handleDoubleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    let radius, color;

    if (config.randomSpawn) {
        radius = 3 + Math.random() * 15;
        color = `hsl(${Math.random() * 360}, 80%, 60%)`;
    } else {
        // Standard mode: Use set size with slight variation
        radius = config.ballSize + (Math.random() * 2);
        // Cycle colors
        color = COLORS[ballsRef.current.length % COLORS.length];
    }

    const newBall: Ball = {
        id: Date.now() + Math.random(), // Ensure unique ID
        pos: mousePos,
        vel: {
            x: (Math.random() - 0.5) * 15,
            y: (Math.random() - 0.5) * 15
        },
        radius: radius,
        color: color,
        trail: [],
        isPinned: false
    };

    ballsRef.current.push(newBall);
    setBalls([...ballsRef.current]); // Update state to trigger re-renders if necessary (e.g. counters)
  };

  const togglePin = (pos: Vector2) => {
    for (const ball of ballsRef.current) {
        // Increased hit area slightly for better touch experience (radius + 15)
        if (dist(pos, ball.pos) < ball.radius + 15) { 
            ball.isPinned = !ball.isPinned;
            if (ball.isPinned) {
                ball.vel = { x: 0, y: 0 };
                // Haptic feedback for mobile
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(50);
                }
            } else {
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(20);
                }
            }
            return true;
        }
    }
    return false;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!config.isGodMode || !paused) return;
    
    // Check for Left Click (Main click)
    if (e.button !== 0) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    mousePosRef.current = mousePos;

    // --- Start Long Press Logic (for Pinning on Touch) ---
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressStartPosRef.current = mousePos;
    longPressTimerRef.current = setTimeout(() => {
        const success = togglePin(mousePosRef.current);
        if (success) {
             // If pinned via long press, stop any potential drag
             dragStateRef.current = null;
        }
        longPressTimerRef.current = null;
    }, 600);
    // -----------------------------------------------------

    // 1. Check Velocity Handle Click
    for (const ball of ballsRef.current) {
       const velEnd = add(ball.pos, mult(ball.vel, 10)); // Scale visual vector
       if (dist(mousePos, velEnd) < 10) {
           dragStateRef.current = { type: 'VELOCITY', id: ball.id };
           return;
       }
    }

    // 2. Check Ball Click (Drag)
    for (const ball of ballsRef.current) {
        if (dist(mousePos, ball.pos) < ball.radius + 5) {
            dragStateRef.current = { 
                type: 'BALL', 
                id: ball.id, 
                offset: sub(ball.pos, mousePos) 
            };
            return;
        }
    }

    // 3. Check Wall Click (Removal/Restore)
    if (hoveredWallRef.current) {
        const wallId = hoveredWallRef.current;
        if (manualGapsRef.current.has(wallId)) {
            manualGapsRef.current.delete(wallId);
        } else {
            manualGapsRef.current.add(wallId);
        }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      mousePosRef.current = mousePos;

      // --- Cancel Long Press if Moved ---
      if (longPressTimerRef.current && longPressStartPosRef.current) {
          if (dist(mousePos, longPressStartPosRef.current) > 10) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
          }
      }
      // ----------------------------------

      // Drag Logic
      if (dragStateRef.current) {
          const ball = ballsRef.current.find(b => b.id === dragStateRef.current?.id);
          if (ball && !ball.isPinned) {
              if (dragStateRef.current.type === 'BALL') {
                  ball.pos = add(mousePos, dragStateRef.current.offset);
                  ball.trail = []; // Reset trail
              } else if (dragStateRef.current.type === 'VELOCITY') {
                  const newVel = mult(sub(mousePos, ball.pos), 0.1); // 0.1 scale factor
                  ball.vel = newVel;
              }
          }
      }
  };

  const handlePointerUp = () => {
      if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
      }
      dragStateRef.current = null;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
      if (!config.isGodMode) return;
      e.preventDefault();
      
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      // Shared logic
      togglePin(mousePos);
  };

  // Main Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      // Set physical size for high DPI
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      
      // Set logical size for CSS
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;

      // Scale drawing context so we can continue using logical coordinates
      ctx.scale(dpr, dpr);
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    const update = () => {
      // Use logical dimensions for physics and positioning logic
      const width = window.innerWidth;
      const height = window.innerHeight;
      const center = { x: width / 2, y: height / 2 };
      const maxRadius = Math.min(width, height) * 0.45 * config.baseScale;
      
      // -- Audio Analysis --
      let currentElasticity = config.elasticity;
      let micVolume = 0;
      if (config.micControlEnabled && micAnalyserRef.current) {
          const dataArray = new Uint8Array(micAnalyserRef.current.frequencyBinCount);
          micAnalyserRef.current.getByteFrequencyData(dataArray);
          // Calculate average volume
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          // Normalize 0-1 (approx)
          micVolume = Math.min(1, average / 128);
          
          // Map volume to elasticity. 
          // Low volume = dampening (< 1.0)
          // High volume = energy injection (> 1.0)
          // Sensitivity scales the effect
          currentElasticity = 0.5 + (micVolume * config.micSensitivity * 0.4);
      }

      // -- Background --
      // Use logical coordinates for drawing, the context scale handles the rest
      const gradient = ctx.createRadialGradient(center.x, center.y, maxRadius * 0.2, center.x, center.y, Math.max(width, height));
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(0.4, '#1e1b4b');
      gradient.addColorStop(1, '#000000');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 80; i++) {
          const time = Date.now() * 0.0002;
          const x = (Math.sin(i * 132.1 + time) * width + width) % width;
          const y = (Math.cos(i * 453.2 + time * 0.5) * height + height) % height;
          const size = Math.abs(Math.sin(i * 10 + time * 5)) * 1.5;
          ctx.globalAlpha = 0.3 + Math.random() * 0.7;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      const sides = Math.max(3, config.polygonSides);
      const angleStep = (Math.PI * 2) / sides;

      // Physics Loop
      if (!paused) {
        for (let step = 0; step < SUB_STEPS; step++) {
          rotationRef.current += config.rotationSpeed / SUB_STEPS;
          const currentRotation = rotationRef.current;

          // Process Balls
          for (let b = ballsRef.current.length - 1; b >= 0; b--) {
            const ball = ballsRef.current[b];

            if (ball.isPinned) continue; // Skip updates for pinned balls

            // 1. Move Ball
            ball.vel.y += config.gravity / SUB_STEPS;
            ball.vel = mult(ball.vel, Math.pow(0.9995, 1 / SUB_STEPS));
            
            // --- Anti-Tunneling Fix ---
            // Ensure the ball cannot travel more than 80% of its radius in a single sub-step.
            // This guarantees collision detection catches it before it passes through a wall.
            const currentSpeed = mag(ball.vel);
            const maxStepSpeed = ball.radius * 0.8; 
            const maxFrameSpeed = maxStepSpeed * SUB_STEPS; 

            if (currentSpeed > maxFrameSpeed) {
                ball.vel = mult(ball.vel, maxFrameSpeed / currentSpeed);
            }
            // --------------------------

            ball.pos = add(ball.pos, mult(ball.vel, 1 / SUB_STEPS));

            // 2. Ball-Ball Collision (Optimized for Sub-steps)
            // Check collisions if enabled GLOBALLY OR if one of the balls is PINNED (which acts as an obstacle)
            if ((config.enableBallCollisions || ballsRef.current.some(b => b.isPinned)) && (SUB_STEPS < 4 || step % 2 === 0)) {
                for (let j = 0; j < ballsRef.current.length; j++) {
                    if (b === j) continue;
                    const other = ballsRef.current[j];
                    
                    // Optimization: if global off, only collide if 'other' is pinned.
                    // If global is on, collide with everyone.
                    // However, we are iterating 'b' (dynamic). If 'other' is not pinned and global is off, skip.
                    if (!config.enableBallCollisions && !other.isPinned) continue;

                    const distSqVal = distSq(ball.pos, other.pos);
                    const minDist = ball.radius + other.radius;
                    
                    if (distSqVal < minDist * minDist) {
                        const distance = Math.sqrt(distSqVal);
                        const normal = mult(sub(ball.pos, other.pos), 1 / distance);
                        const overlap = minDist - distance;
                        
                        if (other.isPinned) {
                            // Collision with Static Object (Infinite Mass)
                            ball.pos = add(ball.pos, mult(normal, overlap)); // Push out completely
                            
                            // Reflect velocity
                            const vDotN = dot(ball.vel, normal);
                            if (vDotN < 0) {
                                ball.vel = sub(ball.vel, mult(normal, 2 * vDotN));
                                ball.vel = mult(ball.vel, currentElasticity); // Use mic elasticity for dynamics
                                
                                // Record Collision
                                collisionCountRef.current++;
                            }
                        } else {
                            // Dynamic - Dynamic Collision
                            // Separate
                            const push = mult(normal, overlap * 0.5);
                            ball.pos = add(ball.pos, push);
                            other.pos = sub(other.pos, push);

                            // Elastic Bounce
                            const relVel = sub(ball.vel, other.vel);
                            const sepVel = dot(relVel, normal);
                            if (sepVel < 0) {
                                const impulse = mult(normal, sepVel);
                                ball.vel = sub(ball.vel, impulse);
                                other.vel = add(other.vel, impulse);
                                
                                ball.vel = mult(ball.vel, 0.99);
                                other.vel = mult(other.vel, 0.99);
                                
                                // Record Collision
                                collisionCountRef.current++;
                            }
                        }
                    }
                }
            }

            // 3. Wall Collision (Multi-layer)
            for (let layer = 0; layer < config.polygonLayers; layer++) {
                const layerRadius = maxRadius - (layer * config.layerSpacing);
                if (layerRadius <= 0) continue;

                if (config.isCircle) {
                    // Circle Logic
                    const distToCenter = mag(sub(ball.pos, center));
                    const wallId = `${layer}-0`;

                    // Check Gaps
                    let isInGap = false;
                    if (config.gapCount > 0) {
                         let angle = Math.atan2(ball.pos.y - center.y, ball.pos.x - center.x);
                         let relAngle = angle - currentRotation;
                         relAngle = relAngle % (Math.PI * 2);
                         if (relAngle < 0) relAngle += Math.PI * 2;
                         const drawAngle = ((sides - config.gapCount) / sides) * Math.PI * 2;
                         if (relAngle > drawAngle) isInGap = true;
                    }
                    if (manualGapsRef.current.has(wallId)) isInGap = true; 

                    if (!isInGap) {
                        const distToEdge = Math.abs(distToCenter - layerRadius);
                        if (distToEdge < ball.radius) {
                             let wallNormal = normalize(sub(center, ball.pos));
                             if (distToCenter > layerRadius) wallNormal = mult(wallNormal, -1);

                             if (dot(ball.vel, wallNormal) < 0) {
                                 const vDotN = dot(ball.vel, wallNormal);
                                 playBounceSound(mag(ball.vel));
                                 ball.vel = sub(ball.vel, mult(wallNormal, 2 * vDotN));
                                 ball.vel = mult(ball.vel, currentElasticity);
                                 
                                 const tangent = { x: -wallNormal.y, y: wallNormal.x };
                                 ball.vel = add(ball.vel, mult(tangent, config.rotationSpeed * layerRadius * 0.05));
                                 
                                 const pen = ball.radius - distToEdge;
                                 ball.pos = add(ball.pos, mult(wallNormal, pen));

                                 if (config.isDestructible) {
                                     manualGapsRef.current.add(wallId);
                                 }

                                 // Record Wall Collision
                                 // Logic: If ball collisions disabled (default mode), always count.
                                 // If ball collisions enabled, only count if recordWallCollisions is true.
                                 if (!config.enableBallCollisions || config.recordWallCollisions) {
                                     collisionCountRef.current++;
                                 }
                             }
                        }
                    }

                } else {
                    // Polygon Logic
                    const layerVertices: Vector2[] = [];
                    for (let i = 0; i < sides; i++) {
                        layerVertices.push({
                            x: center.x + Math.cos(currentRotation + i * angleStep) * layerRadius,
                            y: center.y + Math.sin(currentRotation + i * angleStep) * layerRadius,
                        });
                    }

                    for (let i = 0; i < sides; i++) {
                        const wallId = `${layer}-${i}`;
                        const isAutoGap = i >= sides - config.gapCount;
                        const isManualGap = manualGapsRef.current.has(wallId);

                        if (isAutoGap || isManualGap) continue;

                        const p1 = layerVertices[i];
                        const p2 = layerVertices[(i + 1) % sides];
                        const { dist, normal } = distToSegment(ball.pos, p1, p2);

                        if (dist < ball.radius) {
                            if (dot(ball.vel, normal) < 0) {
                                const vDotN = dot(ball.vel, normal);
                                playBounceSound(mag(ball.vel));

                                ball.vel = sub(ball.vel, mult(normal, 2 * vDotN));
                                ball.vel = mult(ball.vel, currentElasticity);

                                // Add rotation impart
                                const wallVector = sub(p2, p1);
                                const wallTangent = normalize(wallVector);
                                ball.vel = add(ball.vel, mult(wallTangent, config.rotationSpeed * 40));

                                // Push out
                                ball.pos = add(ball.pos, mult(normal, ball.radius - dist));

                                if (config.isDestructible) {
                                    manualGapsRef.current.add(wallId);
                                }

                                // Record Wall Collision
                                if (!config.enableBallCollisions || config.recordWallCollisions) {
                                    collisionCountRef.current++;
                                }

                            } else {
                                // Prevent sticking
                                if (dist < ball.radius * 0.5) {
                                    ball.pos = add(ball.pos, mult(normal, ball.radius - dist));
                                }
                            }
                        }
                    }
                }
            } // End Layer Loop

            // Boundary & Reduction
            const distFromCenter = mag(sub(ball.pos, center));
            const outerBound = Math.max(width, height) + 100;
            if (distFromCenter > outerBound) {
               if (config.isReductionMode) {
                 ballsRef.current.splice(b, 1);
               } else {
                   if (config.randomSpawn) {
                        const maxDim = Math.min(width, height) * 0.4 * config.baseScale;
                        const angle = Math.random() * Math.PI * 2;
                        const r = Math.random() * maxDim;
                        ball.pos = {
                            x: center.x + Math.cos(angle) * r,
                            y: center.y + Math.sin(angle) * r
                        };
                        ball.color = `hsl(${Math.random() * 360}, 80%, 60%)`;
                   } else {
                       if (config.micControlEnabled) {
                           ball.pos = { x: center.x + (Math.random() - 0.5) * 100, y: center.y + maxRadius - 20 };
                           ball.vel = { x: 0, y: 0 };
                       } else {
                           ball.pos = { x: center.x, y: center.y };
                           ball.vel = { x: (Math.random()-0.5)*5, y: (Math.random()-0.5)*5 };
                       }
                   }
                   ball.trail = [];
               }
            }
          }
        } // End Substeps

        // Update Trails
        ballsRef.current.forEach(ball => {
           if (Math.abs(ball.vel.x) + Math.abs(ball.vel.y) > 0.5 && !ball.isPinned) {
                ball.trail.push({ ...ball.pos });
                if (ball.trail.length > 15) ball.trail.shift();
            }
        });
      } // End !Paused

      // --- Rendering ---
      const renderRotation = rotationRef.current;
      hoveredWallRef.current = null; // Reset hover check
      const text = t[config.language];

      // Draw Layers
      for (let layer = 0; layer < config.polygonLayers; layer++) {
          const layerRadius = maxRadius - (layer * config.layerSpacing);
          if (layerRadius <= 0) continue;

          // Color based on layer
          const layerColor = layer === 0 ? (config.gapCount > 0 ? '#ff0055' : '#00aaff') : 
                             layer % 2 === 0 ? '#00ccff' : '#cc00ff';
          
          ctx.lineWidth = 6;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.shadowBlur = layer === 0 ? 20 : 10;
          ctx.shadowColor = layerColor;
          ctx.strokeStyle = layerColor;

          if (config.isCircle) {
             const wallId = `${layer}-0`;
             const manualCircleGap = manualGapsRef.current.has(wallId);

             // God Mode Hover Check
             if (config.isGodMode && paused && !hoveredWallRef.current) {
                 const distToMouse = Math.abs(mag(sub(mousePosRef.current, center)) - layerRadius);
                 if (distToMouse < 20) {
                     hoveredWallRef.current = wallId;
                 }
             }

             if (manualCircleGap) {
                 ctx.strokeStyle = '#666'; 
                 ctx.globalAlpha = 0.3;
                 ctx.setLineDash([5, 10]);
             } else {
                 ctx.setLineDash([]);
             }

             if (config.gapCount > 0 && !manualCircleGap) {
                const totalAngle = Math.PI * 2;
                const gapAngle = (config.gapCount / sides) * totalAngle;
                const drawAngle = totalAngle - gapAngle;
                ctx.beginPath();
                ctx.arc(center.x, center.y, layerRadius, renderRotation, renderRotation + drawAngle);
                ctx.stroke();
             } else {
                ctx.beginPath();
                ctx.arc(center.x, center.y, layerRadius, 0, Math.PI * 2);
                ctx.stroke();
             }
             ctx.globalAlpha = 1.0;
             
             // Draw Hover Highlight
             if (hoveredWallRef.current === wallId) {
                 ctx.strokeStyle = manualCircleGap ? '#00ff00' : '#ffffff';
                 ctx.lineWidth = 8;
                 ctx.setLineDash(manualCircleGap ? [5, 5] : []);
                 ctx.beginPath();
                 ctx.arc(center.x, center.y, layerRadius, 0, Math.PI * 2);
                 ctx.stroke();
                 ctx.lineWidth = 6;
             }

          } else {
            // Vertices for this layer
            const layerVertices: Vector2[] = [];
            for (let i = 0; i < sides; i++) {
                layerVertices.push({
                    x: center.x + Math.cos(renderRotation + i * angleStep) * layerRadius,
                    y: center.y + Math.sin(renderRotation + i * angleStep) * layerRadius,
                });
            }

            for (let i = 0; i < sides; i++) {
                const p1 = layerVertices[i];
                const p2 = layerVertices[(i + 1) % sides];
                const wallId = `${layer}-${i}`;
                const isAutoGap = i >= sides - config.gapCount;
                const isManualGap = manualGapsRef.current.has(wallId);

                if (isAutoGap) continue;

                // God Mode Hover Check (Before rendering style decision)
                if (config.isGodMode && paused && !hoveredWallRef.current) {
                    const { dist } = distToSegment(mousePosRef.current, p1, p2);
                    if (dist < 20) { // Increased hit area
                        hoveredWallRef.current = wallId;
                    }
                }

                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                
                if (isManualGap) {
                    // Render ghost wall if removed, so we can see what to restore
                    ctx.strokeStyle = '#666'; 
                    ctx.globalAlpha = 0.3;
                    ctx.setLineDash([5, 5]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.globalAlpha = 1.0;
                } else {
                    ctx.strokeStyle = layerColor;
                    ctx.stroke();
                }

                // Draw Hover Highlight on top
                if (hoveredWallRef.current === wallId) {
                    ctx.strokeStyle = isManualGap ? '#00ff00' : '#ffffff'; // Green to restore, White to remove
                    ctx.lineWidth = 8;
                    ctx.lineCap = 'round';
                    ctx.setLineDash(isManualGap ? [5, 5] : []);
                    ctx.stroke();
                    ctx.lineWidth = 6; // Reset
                }
            }
          }
      }
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);

      // Draw Balls
      ballsRef.current.forEach(ball => {
        // Draw Trail
        if (ball.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(ball.trail[0].x, ball.trail[0].y);
            for (let i = 1; i < ball.trail.length; i++) {
                 ctx.lineTo(ball.trail[i].x, ball.trail[i].y);
            }
            ctx.strokeStyle = ball.color; 
            ctx.globalAlpha = 0.4;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }

        // Draw Ball
        ctx.beginPath();
        ctx.arc(ball.pos.x, ball.pos.y, ball.radius, 0, Math.PI * 2);
        
        // Visual for Pinned State
        if (ball.isPinned) {
            ctx.fillStyle = '#ff0000'; // Red core for pinned
            ctx.shadowColor = '#ff0000';
        } else {
            ctx.fillStyle = ball.color;
            ctx.shadowColor = ball.color;
        }
        
        // Highlight in God Mode if hovered/selected
        const isHovered = config.isGodMode && dist(mousePosRef.current, ball.pos) < ball.radius + 5;
        if ((isHovered && paused) || dragStateRef.current?.id === ball.id) {
             ctx.fillStyle = '#ffffff';
             ctx.shadowColor = '#ffffff';
             ctx.shadowBlur = 20;
        } else {
             ctx.shadowBlur = 15;
        }
        
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw "Pin" indicator (X or Crosshair)
        if (ball.isPinned) {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const r = ball.radius * 0.6;
            ctx.moveTo(ball.pos.x - r, ball.pos.y - r);
            ctx.lineTo(ball.pos.x + r, ball.pos.y + r);
            ctx.moveTo(ball.pos.x + r, ball.pos.y - r);
            ctx.lineTo(ball.pos.x - r, ball.pos.y + r);
            ctx.stroke();
            
            // Outer Ring
            ctx.beginPath();
            ctx.arc(ball.pos.x, ball.pos.y, ball.radius + 3, 0, Math.PI * 2);
            ctx.setLineDash([2, 2]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw Velocity Vector in God Mode
        if (config.isGodMode && paused && !ball.isPinned) {
            const velEnd = add(ball.pos, mult(ball.vel, 10)); // Visual scale 10x
            ctx.beginPath();
            ctx.moveTo(ball.pos.x, ball.pos.y);
            ctx.lineTo(velEnd.x, velEnd.y);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Arrow head
            ctx.beginPath();
            ctx.arc(velEnd.x, velEnd.y, 4, 0, Math.PI*2);
            ctx.fillStyle = 'white';
            ctx.fill();
        }
      });

      if (config.isReductionMode) {
          ctx.font = '20px monospace';
          ctx.fillStyle = '#ff5555';
          ctx.textAlign = 'center';
          ctx.fillText(`${text.remaining}: ${ballsRef.current.length}`, center.x, center.y + maxRadius + 50);
      }
      
      if (config.isGodMode && paused) {
           ctx.font = '16px monospace';
           ctx.fillStyle = '#fbbf24';
           ctx.textAlign = 'center';
           ctx.fillText(text.godModeOverlay, center.x, height - 30);
      } else if (config.micControlEnabled) {
           ctx.font = '14px monospace';
           ctx.fillStyle = '#00aaff';
           ctx.textAlign = 'center';
           ctx.fillText(`${text.micElasticity}: ${(currentElasticity * 100).toFixed(0)}%`, center.x, height - 30);
      }

      requestRef.current = requestAnimationFrame(update);
    };

    requestRef.current = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [config, paused, restartTrigger, playBounceSound, setTotalCollisions]);

  return (
    <canvas 
        ref={canvasRef} 
        className={`block w-full h-full ${config.isGodMode && paused ? 'cursor-grab' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
    />
  );
};
