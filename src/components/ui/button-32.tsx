"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";

const MotionButton = motion.create(Button);
const DEFAULT_EMOJIS = ["😀", "😂", "❤️", "👍", "🎉", "😍"];
const GRAVITY = 0.9;
const AIR_DRAG = 0.99;
const RESTITUTION = 0.35;
const SPEED_SCALE = 0.85;

type Particle = {
  x: number; y: number; vx: number; vy: number; rotation: number; vr: number;
  size: number; emoji: string; born: number; life: number; resting: boolean;
};
type Box = { left: number; top: number; right: number; bottom: number };
type AshSim = {
  particles: Particle[]; raf: number; canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D; startedAt: number; box: Box;
};

export interface EmojiBurstButtonProps extends Omit<React.ComponentProps<typeof MotionButton>, "onClick"> {
  children?: React.ReactNode;
  label?: React.ReactNode;
  emojis?: string[];
  particleCount?: number;
  spread?: number;
  startVelocity?: number;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onReact?: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sizeCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, box: Box) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, box.right - box.left);
  const h = Math.max(1, box.bottom - box.top);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.left = `${box.left}px`;
  canvas.style.top = `${box.top}px`;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function computeBurstBox(rect: DOMRect, startVelocity: number): Box {
  const scaledV = startVelocity * SPEED_SCALE;
  const peakRise = (scaledV * scaledV) / (2 * GRAVITY);
  const marginX = Math.max(140, rect.width * 1.2, scaledV * 3.5);
  return {
    left: Math.max(0, rect.left - marginX),
    right: Math.min(window.innerWidth, rect.right + marginX),
    top: Math.max(0, rect.top - peakRise - 90),
    bottom: Math.min(window.innerHeight, rect.bottom + peakRise * 0.85 + 120),
  };
}

function collideWithBox(p: Particle, box: Box) {
  if (p.resting) return;
  const r = Math.max(p.size * 0.4, 1);
  const cx = clamp(p.x, box.left, box.right);
  const cy = clamp(p.y, box.top, box.bottom);
  const dx = p.x - cx;
  const dy = p.y - cy;
  const dist2 = dx * dx + dy * dy;
  if (dist2 >= r * r) return;
  const dist = Math.sqrt(dist2) || 0.001;
  const nx = dx / dist;
  const ny = dy / dist;
  p.x = cx + nx * r;
  p.y = cy + ny * r;
  const dot = p.vx * nx + p.vy * ny;
  if (dot < 0) {
    p.vx -= (1 + RESTITUTION) * dot * nx;
    p.vy -= (1 + RESTITUTION) * dot * ny;
  }
  if (ny < -0.35 && Math.abs(p.vy) < 0.8) {
    p.vx *= 0.6;
    p.vy = 0;
    p.resting = true;
  }
}

function createAshSimulation(canvas: HTMLCanvasElement, button: HTMLElement,
  options: { particleCount: number; spread: number; startVelocity: number; emojis: string[] },
): AshSim | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null; // Revealing still works if canvas is unavailable.
  const rect = button.getBoundingClientRect();
  const box = computeBurstBox(rect, options.startVelocity);
  sizeCanvas(canvas, ctx, box);
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const now = performance.now();
  const count = clamp(options.particleCount, 8, 100);
  const halfSpread = (options.spread * Math.PI) / 180 / 2;
  const particles: Particle[] = [];
  const emojis = options.emojis.length ? options.emojis : DEFAULT_EMOJIS;
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() * 2 - 1) * halfSpread;
    const speed = options.startVelocity * SPEED_SCALE * (0.6 + Math.random() * 0.55);
    particles.push({
      x: cx + (Math.random() - 0.5) * rect.width * 0.4,
      y: cy + (Math.random() - 0.5) * rect.height * 0.3,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 5,
      vy: Math.sin(angle) * speed, rotation: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.75, size: 16 + Math.random() * 14,
      emoji: emojis[Math.floor(Math.random() * emojis.length)]!,
      born: now, life: 1300 + Math.random() * 900, resting: false,
    });
  }
  return { particles, raf: 0, canvas, ctx, startedAt: now, box };
}

function paintSim(sim: AshSim, button: HTMLElement) {
  const { ctx, canvas, particles, box: region } = sim;
  const floor = button.getBoundingClientRect();
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  const now = performance.now();
  const toRemove: Particle[] = [];
  for (const p of particles) {
    if (!p.resting) {
      p.vy += GRAVITY;
      p.vx *= AIR_DRAG; p.vy *= AIR_DRAG;
      p.x += p.vx; p.y += p.vy; p.rotation += p.vr;
      collideWithBox(p, floor);
    }
    const fade = Math.max(0, 1 - (now - p.born) / p.life);
    if (fade <= 0 || p.y > region.bottom + 48 || p.y < region.top - 48 ||
      p.x < region.left - 48 || p.x > region.right + 48) {
      toRemove.push(p); continue;
    }
    ctx.save();
    ctx.translate(p.x - region.left, p.y - region.top);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = 0.5 + fade * 0.5;
    ctx.font = `${p.size}px serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(p.emoji, 0, 0);
    ctx.restore();
  }
  for (const p of toRemove) particles.splice(particles.indexOf(p), 1);
  return particles.length > 0 && now - sim.startedAt < 6000;
}

const EmojiBurstButton = React.forwardRef<HTMLButtonElement, EmojiBurstButtonProps>(
  ({ children, label = "Curtir", emojis = DEFAULT_EMOJIS, particleCount = 28,
    spread = 110, startVelocity = 30, onReact, onClick, className, disabled,
    variant = "default", size, type = "button", ...props }, ref) => {
    const buttonRef = React.useRef<HTMLButtonElement | null>(null);
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const simRef = React.useRef<AshSim | null>(null);
    const burnControls = useAnimationControls();
    const preferReducedMotion = useReducedMotion();
    // The portal is created on interaction, so server and initial client output match.
    const [portalReady, setPortalReady] = React.useState(false);
    React.useImperativeHandle(ref, () => buttonRef.current!);

    const stopSim = React.useCallback(() => {
      const sim = simRef.current;
      if (sim) {
        cancelAnimationFrame(sim.raf);
        sim.ctx.clearRect(0, 0, sim.canvas.clientWidth, sim.canvas.clientHeight);
        sim.canvas.style.opacity = "0";
        simRef.current = null;
      }
    }, []);
    React.useEffect(() => stopSim, [stopSim]);
    React.useEffect(() => {
      if (preferReducedMotion) stopSim();
    }, [preferReducedMotion, stopSim]);

    const startBurst = React.useCallback((canvas: HTMLCanvasElement | null) => {
      canvasRef.current = canvas;
      const button = buttonRef.current;
      if (!button || !canvas || preferReducedMotion) return;
      stopSim();
      const sim = createAshSimulation(canvas, button, { particleCount, spread, startVelocity, emojis });
      if (!sim) return;
      canvas.style.opacity = "1";
      simRef.current = sim;
      const tick = () => {
        const current = simRef.current;
        const btn = buttonRef.current;
        if (!current || !btn) return;
        if (paintSim(current, btn)) current.raf = requestAnimationFrame(tick);
        else stopSim();
      };
      sim.raf = requestAnimationFrame(tick);
    }, [emojis, particleCount, spread, startVelocity, stopSim, preferReducedMotion]);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      onClick?.(event);
      if (event.defaultPrevented) return;
      if (!preferReducedMotion) {
        if (canvasRef.current) startBurst(canvasRef.current);
        else setPortalReady(true);
        void burnControls.start({ scale: [1, 0.88, 1.06, 1],
          transition: { duration: 0.45, times: [0, 0.3, 0.65, 1], ease: "easeOut" } });
      }
      onReact?.();
    };

    return <>
      {portalReady ? createPortal(<canvas ref={startBurst} aria-hidden className="pointer-events-none fixed z-80" style={{ opacity: 0 }} />, document.body) : null}
      <MotionButton ref={buttonRef} type={type} variant={variant} size={size}
        disabled={disabled} onClick={handleClick} className={className} animate={burnControls} {...props}>
        {children ?? label}
      </MotionButton>
    </>;
  },
);
EmojiBurstButton.displayName = "EmojiBurstButton";
export { EmojiBurstButton };
export default function EmojiBurstButtonDemo() { return <EmojiBurstButton label="Curtir" />; }
