
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Point, ToxicSpot, GameState, Lump, Bomb, Hole } from './types';
import { SETTINGS, COLORS } from './constants';
import GameBoard from './components/GameBoard';
import { GoogleGenAI } from '@google/genai';
import { audioManager } from './AudioManager';

const JOYSTICK_CONTAINER_SIZE = 160;
const JOYSTICK_RADIUS = 60;
const KNOB_SIZE = 50;

const App: React.FC = () => {
  const [snake, setSnake] = useState<Point[]>([]);
  const [food, setFood] = useState<Point | null>(null);
  const [lumps, setLumps] = useState<Lump[]>([]);
  const [bomb, setBomb] = useState<Bomb | null>(null);
  const [toxicSpots, setToxicSpots] = useState<ToxicSpot[]>([]);
  const [hole, setHole] = useState<Hole | null>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [aiMotto, setAiMotto] = useState<string>("The cycle deepens.");
  const [isDeadFlash, setIsDeadFlash] = useState(false);
  
  // Joystick State
  const [joystickActive, setJoystickActive] = useState(false);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });

  const angleRef = useRef<number>(-Math.PI / 2);
  const targetAngleRef = useRef<number>(-Math.PI / 2);
  const gameLoopRef = useRef<number | null>(null);
  const snakeRef = useRef<Point[]>([]);
  const lastUpdateRef = useRef<number>(0);

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const fetchAiMotto = async () => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "2-word mantra for a predator that reflects off infinity.",
        config: { temperature: 1.0 }
      });
      if (response.text) setAiMotto(response.text.trim());
    } catch (e) { console.error(e); }
  };

  const generateFood = useCallback((): Point => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const p = SETTINGS.safePadding;
    return {
      x: p + Math.random() * (w - p * 2),
      y: p + Math.random() * (h - p * 2),
    };
  }, []);

  const generateHole = useCallback((): Hole => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const p = SETTINGS.safePadding;
    return {
      x: p + Math.random() * (w - p * 2),
      y: p + Math.random() * (h - p * 2),
      count: 10,
      active: false
    };
  }, []);

  const resetGame = useCallback((isInitial: boolean = false) => {
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight / 2;
    
    const initialSnake: Point[] = [];
    for (let i = 0; i < SETTINGS.snakeLength; i++) {
      initialSnake.push({ x: startX, y: startY + i * 2 });
    }
    
    snakeRef.current = initialSnake;
    setSnake(initialSnake);
    setFood(generateFood());
    setHole(generateHole());
    setLumps([]);
    setBomb(null);
    setToxicSpots([]);
    angleRef.current = -Math.PI / 2;
    targetAngleRef.current = -Math.PI / 2;
    setScore(0);

    if (isInitial) {
      setGameState('PLAYING');
      fetchAiMotto();
      audioManager.playNextTrack();
    } else {
      audioManager.playEnd();
      setIsDeadFlash(true);
      setTimeout(() => setIsDeadFlash(false), 200);
    }
  }, [generateFood, generateHole]);

  const updatePhysics = useCallback((now: number) => {
    const dt = now - lastUpdateRef.current;
    lastUpdateRef.current = now;
    if (dt > 100) return;

    // Smooth turning
    let diff = targetAngleRef.current - angleRef.current;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    angleRef.current += diff * SETTINGS.turnSpeed;

    // Speed reduction (25% slower when digesting)
    const speedMultiplier = lumps.length > 0 ? 0.75 : 1.0;
    const currentSpeed = SETTINGS.speed * speedMultiplier;

    const head = snakeRef.current[0];
    let nextX = head.x + Math.cos(angleRef.current) * currentSpeed;
    let nextY = head.y + Math.sin(angleRef.current) * currentSpeed;

    // Wall Bouncing (Reflection)
    if (nextX < 0 || nextX > window.innerWidth) {
        angleRef.current = Math.PI - angleRef.current;
        targetAngleRef.current = angleRef.current;
        nextX = head.x + Math.cos(angleRef.current) * currentSpeed;
    }
    if (nextY < 0 || nextY > window.innerHeight) {
        angleRef.current = -angleRef.current;
        targetAngleRef.current = angleRef.current;
        nextY = head.y + Math.sin(angleRef.current) * currentSpeed;
    }

    const newHead = { x: nextX, y: nextY };

    // Toxic spot collision (Deadly)
    for (const spot of toxicSpots) {
      const dist = Math.sqrt((newHead.x - spot.x)**2 + (newHead.y - spot.y)**2);
      if (dist < spot.size + 6) {
        resetGame(false);
        return;
      }
    }

    // Hole Collision logic
    if (hole && hole.active) {
        const holeDist = Math.sqrt((newHead.x - hole.x)**2 + (newHead.y - hole.y)**2);
        if (holeDist < 40) {
            // "Next Level" (Restarts for now)
            resetGame(true);
            return;
        }
    }

    // Move snake
    const nextSnake = [newHead, ...snakeRef.current];
    if (food) {
      const foodDist = Math.sqrt((newHead.x - food.x)**2 + (newHead.y - food.y)**2);
      if (foodDist < 25) {
        audioManager.playApple();
        setScore(s => s + 1);
        setFood(null);
        // Start lump at 0 progress (Head)
        setLumps(prev => [...prev, { progress: 0, startTime: now }]);
        
        // Update Hole
        setHole(h => {
            if (!h) return null;
            const newCount = Math.max(0, h.count - 1);
            return { ...h, count: newCount, active: newCount === 0 };
        });
      } else {
        nextSnake.pop();
      }
    } else {
      nextSnake.pop();
    }
    snakeRef.current = nextSnake;

    // Digestion
    setLumps(prev => {
      const updated = prev.map(l => ({
        ...l,
        progress: (now - l.startTime) / SETTINGS.digestionTime
      }));

      const reachingTail = updated.filter(l => l.progress >= 1);
      if (reachingTail.length > 0) {
        const tail = snakeRef.current[snakeRef.current.length - 1];
        setBomb({ x: tail.x, y: tail.y, createdAt: now, exploded: false });
      }

      return updated.filter(l => l.progress < 1);
    });

    // Bomb explosions
    if (bomb && !bomb.exploded) {
      if (now - bomb.createdAt > SETTINGS.bombTime) {
        const newSpots: ToxicSpot[] = [];
        for (let i = 0; i < 16; i++) {
            const r = 10 + Math.random() * 50;
            const a = Math.random() * Math.PI * 2;
            const sizeRand = Math.random();
            const size = sizeRand > 0.85 ? (10 + Math.random() * 5) : (4 + Math.random() * 4);
            newSpots.push({
                x: bomb.x + Math.cos(a) * r,
                y: bomb.y + Math.sin(a) * r,
                size: size / 2
            });
        }
        setToxicSpots(prev => [...prev, ...newSpots]);
        setBomb(null);
        setFood(generateFood());
      }
    }

    setSnake([...snakeRef.current]);
  }, [food, bomb, toxicSpots, hole, lumps, generateFood, resetGame]);

  useEffect(() => {
    const loop = (time: number) => {
      if (gameState === 'PLAYING') {
        updatePhysics(time);
      }
      gameLoopRef.current = requestAnimationFrame(loop);
    };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => { if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current); };
  }, [gameState, updatePhysics]);

  useEffect(() => {
    if (score > highScore) setHighScore(score);
  }, [score, highScore]);

  // Joystick Input Handler
  const handleJoystickMove = (clientX: number, clientY: number) => {
    const joystickElem = document.getElementById('joystick-center');
    if (!joystickElem) return;
    const rect = joystickElem.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    const limitedDist = Math.min(dist, JOYSTICK_RADIUS);
    setKnobPos({
        x: Math.cos(angle) * limitedDist,
        y: Math.sin(angle) * limitedDist
    });

    targetAngleRef.current = angle;
  };

  return (
    <div className={`flex flex-col h-[100dvh] w-screen relative overflow-hidden bg-black transition-transform duration-200 ${isDeadFlash ? 'shake' : ''}`}>
      <div className="absolute inset-0 z-0 pointer-events-none">
        <GameBoard snake={snake} food={food} lumps={lumps} bomb={bomb} toxicSpots={toxicSpots} hole={hole} />
      </div>

      {/* HUD */}
      <div className="absolute top-0 left-0 w-full flex justify-between items-start px-8 pt-12 z-10 pointer-events-none">
        <div className="flex flex-col">
          <span className="text-white/20 text-[10px] uppercase font-black tracking-[0.4em]">Digest</span>
          <span className="text-white text-6xl font-light tabular-nums tracking-tighter opacity-70">{score.toString().padStart(2, '0')}</span>
        </div>
        <div className="text-right flex flex-col items-end">
          <span className="text-white/20 text-[10px] uppercase font-black tracking-[0.4em]">Record</span>
          <span className="text-white/40 text-2xl font-light tabular-nums">{highScore.toString().padStart(2, '0')}</span>
        </div>
      </div>

      {/* Main Game Interface */}
      {gameState === 'PLAYING' && (
        <div className="absolute inset-0 z-20 flex flex-col pointer-events-none">
            {/* Top area is non-interactive for controls */}
            <div className="flex-1" />
            
            {/* Bottom Joystick Area */}
            <div 
                className="h-64 flex items-center justify-center relative pointer-events-auto touch-none"
                onPointerDown={(e) => {
                    setJoystickActive(true);
                    handleJoystickMove(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                    if (joystickActive) handleJoystickMove(e.clientX, e.clientY);
                }}
                onPointerUp={() => {
                    setJoystickActive(false);
                    setKnobPos({ x: 0, y: 0 });
                }}
            >
                <div 
                    id="joystick-center"
                    className="w-40 h-40 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center backdrop-blur-md relative"
                >
                    <div 
                        className="absolute w-12 h-12 rounded-full bg-white/30 border border-white/50 shadow-xl transition-transform duration-75"
                        style={{ transform: `translate(${knobPos.x}px, ${knobPos.y}px)` }}
                    />
                </div>
            </div>
            
            <div className="h-8 flex flex-col items-center">
                <p className="text-white/30 text-[9px] font-black uppercase tracking-[0.6em] prism-text text-center px-8">
                    {aiMotto}
                </p>
            </div>
        </div>
      )}

      {gameState === 'START' && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/90 backdrop-blur-xl">
          <div className="flex flex-col items-center gap-12">
            <h1 className="text-white text-8xl font-black italic tracking-tighter uppercase animate-pulse">VIPERA</h1>
            <button 
              onClick={() => resetGame(true)}
              className="w-64 h-16 rounded-full bg-white text-black font-black uppercase tracking-[0.3em] text-[11px] active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.4)]"
            >
              Initiate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
