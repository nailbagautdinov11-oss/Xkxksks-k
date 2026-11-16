import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useStore } from '../store';
import { UnitImg } from './bits';
import { sfx } from '../sound';

const LEN = 52; const WIN_AT = 44;

export function Reel({ pool, winner, duration = 4800, onDone, cardW = 120, delay = 0 }: {
  pool: { unit_id: string; weight: number }[]; winner: string; duration?: number; onDone?: () => void; cardW?: number; delay?: number;
}) {
  const { unitMap, rarityColor } = useStore();
  const box = useRef<HTMLDivElement>(null); const strip = useRef<HTMLDivElement>(null);
  const items = useMemo(() => {
    const total = pool.reduce((a, b) => a + b.weight, 0);
    const pick = () => { let r = Math.random() * total; for (const p of pool) { if ((r -= p.weight) < 0) return p.unit_id; } return pool[0].unit_id; };
    const a = Array.from({ length: LEN }, pick); a[WIN_AT] = winner; return a;
  }, []); // eslint-disable-line

  useEffect(() => {
    const b = box.current!, s = strip.current!;
    const jitter = (Math.random() - 0.5) * cardW * 0.7;
    const target = WIN_AT * cardW + cardW / 2 - b.clientWidth / 2 + jitter;
    let raf = 0, last = -1, done = false;
    const t0 = setTimeout(() => {
      s.style.transition = `transform ${duration}ms cubic-bezier(.12,.62,.08,1)`;
      s.style.transform = `translateX(${-target}px)`;
      const loop = () => {
        const x = b.getBoundingClientRect().left - s.getBoundingClientRect().left + b.clientWidth / 2;
        const idx = Math.floor(x / cardW);
        if (idx !== last) { last = idx; sfx.tick(); }
        if (!done) raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }, 60 + delay);
    const t1 = setTimeout(() => { done = true; onDone?.(); }, duration + 120 + delay);
    return () => { clearTimeout(t0); clearTimeout(t1); cancelAnimationFrame(raf); done = true; };
  }, []); // eslint-disable-line

  return (
    <div className="reel" ref={box} style={{ '--cw': cardW + 'px' } as CSSProperties}>
      <div className="reel-pointer" />
      <div className="reel-strip" ref={strip}>
        {items.map((id, i) => {
          const u = unitMap.get(id)!;
          return (
            <div key={i} className="reel-card" style={{ '--rc': rarityColor(u.rarity) } as CSSProperties}>
              <UnitImg id={id} /><span>{u.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
