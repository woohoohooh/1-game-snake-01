
export type Point = {
  x: number;
  y: number;
};

export type ToxicSpot = Point & {
  size: number;
};

export type Hole = Point & {
  count: number;
  active: boolean;
};

export type GameState = 'START' | 'PLAYING';

export interface Lump {
  progress: number; // 0 to 1 (head to tail)
  startTime: number;
}

export interface Bomb {
  x: number;
  y: number;
  createdAt: number;
  exploded: boolean;
}

export interface GameSettings {
  speed: number;
  turnSpeed: number;
  snakeLength: number;
  safePadding: number;
  digestionTime: number; // ms (10000)
  bombTime: number; // ms (5000)
}
