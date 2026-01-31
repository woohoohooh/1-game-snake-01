
import React, { useRef, useEffect } from 'react';
import { Point, Lump, Bomb, ToxicSpot, Hole } from '../types';
import { COLORS, SETTINGS } from '../constants';

interface GameBoardProps {
  snake: Point[];
  food: Point | null;
  lumps: Lump[];
  bomb: Bomb | null;
  toxicSpots: ToxicSpot[];
  hole: Hole | null;
}

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

const lerpColor = (start: string, end: string, t: number) => {
  const s = hexToRgb(start);
  const e = hexToRgb(end);
  const r = Math.round(s.r + (e.r - s.r) * t);
  const g = Math.round(s.g + (e.g - s.g) * t);
  const b = Math.round(s.b + (e.b - s.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
};

const GameBoard: React.FC<GameBoardProps> = ({ snake, food, lumps, bomb, toxicSpots, hole }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const now = performance.now();

      ctx.clearRect(0, 0, w, h);

      // 0. Hole Rendering (R=48, 3x snake width)
      if (hole) {
          ctx.lineWidth = 4;
          ctx.shadowBlur = hole.active ? 40 : 10;
          ctx.shadowColor = '#fff';
          ctx.strokeStyle = '#fff';
          
          if (hole.active) {
              ctx.fillStyle = '#fff';
              ctx.beginPath();
              ctx.arc(hole.x, hole.y, 48, 0, Math.PI * 2);
              ctx.fill();
          } else {
              ctx.beginPath();
              ctx.arc(hole.x, hole.y, 48, 0, Math.PI * 2);
              ctx.stroke();
              
              ctx.fillStyle = '#fff';
              ctx.font = 'bold 32px Outfit';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(hole.count.toString(), hole.x, hole.y);
          }
      }

      // 1. Toxic Spots
      ctx.shadowBlur = 10;
      ctx.shadowColor = COLORS.toxic;
      ctx.fillStyle = COLORS.toxic;
      for (const spot of toxicSpots) {
        ctx.beginPath();
        ctx.arc(spot.x, spot.y, spot.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Grid
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 0.5;
      const step = 100;
      ctx.shadowBlur = 0;
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // 3. Apple-Bomb (Expelled, 2x size)
      if (bomb) {
        const elapsed = now - bomb.createdAt;
        const progress = Math.min(elapsed / SETTINGS.bombTime, 1);
        const pulse = 0.4 * Math.sin(elapsed / 100);
        const baseRadius = 16; 
        
        ctx.shadowBlur = 30 + progress * 60;
        ctx.shadowColor = COLORS.bomb;
        ctx.fillStyle = COLORS.bomb;
        ctx.beginPath();
        ctx.arc(bomb.x, bomb.y, baseRadius + pulse * 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(bomb.x - 4, bomb.y - 4, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // 4. Red Food
      if (food) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = COLORS.food;
        ctx.fillStyle = COLORS.food;
        ctx.beginPath();
        ctx.arc(food.x, food.y, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Snake
      if (snake.length > 0) {
        // LAYER A: MAIN WHITE BODY
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 25;
        ctx.shadowColor = 'rgba(255,255,255,0.4)';
        ctx.strokeStyle = COLORS.snake;
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(snake[0].x, snake[0].y);
        for (let i = 1; i < snake.length; i++) {
          ctx.lineTo(snake[i].x, snake[i].y);
        }
        ctx.stroke();

        // LAYER B: INNER CORE LINE (Drawn BEFORE lumps to avoid the line-over-apple issue)
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(snake[0].x, snake[0].y);
        for (let i = 1; i < snake.length; i++) {
          ctx.lineTo(snake[i].x, snake[i].y);
        }
        ctx.stroke();

        // LAYER C: BULGES AND DIGESTION LUMPS
        lumps.forEach(lump => {
          const totalSegments = snake.length - 1;
          const position = lump.progress * totalSegments;
          const idx = Math.floor(position);
          const nextIdx = Math.min(idx + 1, totalSegments);
          const segmentProgress = position - idx;

          const p1 = snake[idx];
          const p2 = snake[nextIdx];

          if (p1 && p2) {
            const lumpX = p1.x + (p2.x - p1.x) * segmentProgress;
            const lumpY = p1.y + (p2.y - p1.y) * segmentProgress;

            // Lump size: Grows from R=8 (head) to R=16 (tail)
            const currentLumpRadius = 8 + (lump.progress * 8);
            
            // Bulge skin thickness: gets thinner toward tail (tightening)
            // Starts at 6px margin, ends at 1.5px margin
            const skinMargin = 6 - (lump.progress * 4.5);
            const bulgeRadius = currentLumpRadius + skinMargin;

            // Bulge Skin (same white as snake body, effectively masking the core line)
            ctx.shadowBlur = 30;
            ctx.shadowColor = 'rgba(255,255,255,0.6)';
            ctx.fillStyle = COLORS.snake;
            ctx.beginPath();
            ctx.arc(lumpX, lumpY, bulgeRadius, 0, Math.PI * 2); 
            ctx.fill();

            // The Digesting Lump (Color shift and size growth)
            const currentColor = lerpColor(COLORS.food, COLORS.bomb, lump.progress);
            ctx.shadowBlur = 12;
            ctx.shadowColor = currentColor;
            ctx.fillStyle = currentColor;
            ctx.beginPath();
            ctx.arc(lumpX, lumpY, currentLumpRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Subtle highlight on lump
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            ctx.arc(lumpX - (currentLumpRadius * 0.3), lumpY - (currentLumpRadius * 0.3), currentLumpRadius * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
          }
        });

        // LAYER D: HEAD (Drawn last for prominence)
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 35;
        ctx.shadowColor = '#fff';
        ctx.beginPath();
        ctx.arc(snake[0].x, snake[0].y, 11, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = '#000';
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(snake[0].x - 4, snake[0].y - 3, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(snake[0].x + 4, snake[0].y - 3, 2, 0, Math.PI * 2); ctx.fill();
      }
    };

    let animationFrameId = requestAnimationFrame(function loop() {
      draw();
      animationFrameId = requestAnimationFrame(loop);
    });

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [snake, food, lumps, bomb, toxicSpots, hole]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
};

export default GameBoard;
