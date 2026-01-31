
import { GameSettings } from './types';

export const SETTINGS: GameSettings = {
  speed: 3.0,
  turnSpeed: 0.08,
  snakeLength: 40, 
  safePadding: 80,
  digestionTime: 10000, 
  bombTime: 5000,
};

export const COLORS = {
  background: '#000000',
  snake: '#ffffff',
  food: '#ff0055',
  bomb: '#22ff44',
  toxic: '#11aa22',
  accent: '#00f2ff',
  grid: 'rgba(255, 255, 255, 0.03)'
};
