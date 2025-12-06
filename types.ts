
export interface Vector2 {
  x: number;
  y: number;
}

export interface Ball {
  id: number;
  pos: Vector2;
  vel: Vector2;
  radius: number;
  color: string;
  trail: Vector2[];
  isPinned?: boolean; // New: If true, ball is fixed in place
}

export type SoundScheme = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'synth' | 'bell' | 'glitch';

export type Language = 'en-US' | 'en-GB' | 'zh-Hans' | 'zh-Hant' | 'ja-JP' | 'ko-KR';

export interface GameConfig {
  language: Language; // New: Selected language

  ballCount: number;
  polygonSides: number; // 3 to ...
  isCircle: boolean;
  gapCount: number; // Number of missing sides (0 to polygonSides-1)
  rotationSpeed: number; // radians per frame
  spawnPos: Vector2; // Relative to center (-1 to 1)
  gravity: number;
  elasticity: number; // Bounce energy conservation
  ballSize: number;
  isReductionMode: boolean; // If true, balls are removed when they escape instead of respawning
  soundEnabled: boolean;
  
  // New Features
  isGodMode: boolean;
  enableBallCollisions: boolean;
  polygonLayers: number; // 1 to 20
  layerSpacing: number; // Distance between layers
  
  baseScale: number; // Polygon size scaler (0.1 to 1.5)
  isDestructible: boolean; // Walls break on impact
  randomSpawn: boolean; // Randomize all ball properties
  soundScheme: SoundScheme;
  
  // Mic Control
  micControlEnabled: boolean;
  micSensitivity: number; // 1 to 10
}

export const INITIAL_CONFIG: GameConfig = {
  language: 'zh-Hans', // Default to Simplified Chinese
  ballCount: 50,
  polygonSides: 6,
  isCircle: false,
  gapCount: 0,
  rotationSpeed: 0.005,
  spawnPos: { x: 0, y: -0.2 },
  gravity: 0.05,
  elasticity: 0.95,
  ballSize: 6,
  isReductionMode: false,
  soundEnabled: false,
  isGodMode: false,
  enableBallCollisions: false,
  polygonLayers: 1,
  layerSpacing: 60,
  baseScale: 1.0,
  isDestructible: false,
  randomSpawn: false,
  soundScheme: 'sine',
  micControlEnabled: false,
  micSensitivity: 5,
};
