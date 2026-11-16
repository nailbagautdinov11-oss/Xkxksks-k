import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { useStore } from '../store';
import { fmt, fmtFull } from '../api';
import { sfx } from '../sound';

export const Gem = ({ n, full, className = '' }: { n: number; full?: boolean; className?: string }) => (
  <span className={`gem ${className}`} title={fmtFull(n)}><i className="gem-ico" />{full ? fmtFull(n) : fmt(n)}</span>
);

export function UnitImg({ id, className = '' }: { id: string; className?: string }) {
  return <img className={`unit-img ${className}`} src={`/unit-img/${id}.svg`} alt="" loading="lazy" draggable={false} />;
}

export function UnitCard({ id, qty, selected, onClick, small, price, chance, children, badge }: {
  id: string; qty?: number; selected?: boolean; onClick?: () => void; small?: boolean; price?: number; chance?: number; children?: ReactNode; badge?: string;
}) {
  const { unitMap, rarityColor } = useStore();
  const u = unitMap.get(id); if (!u) return null;
  const c = rarityColor(u.rarity);
  return (
    <div className={`ucard r-${u.rarity} ${selected ? 'sel' : ''} ${small ? 'small' : ''} ${onClick ? 'clickable' : ''}`}
      style={{ '--rc': c } as CSSProperties} onClick={onClick}>
      {qty && qty > 1 ? <span className="qty">×{qty}</span> : null}
      {badge ? <span className="badge">{badge}</span> : null}
      <UnitImg id={id} />
      <div className="uname">{u.name}</div>
      <div className="umeta"><span className="rar">{u.rarity}</span><Gem n={price ?? u.value} /></div>
      {chance !== undefined && <div className="chance">{chance >= 0.1 ? (chance * 100).toFixed(1) : (chance * 100).toFixed(chance >= 0.001 ? 2 : 3)}%</div>}
      {children}
    </div>
  );
}

export function Modal({ onClose, children, wide }: { onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`}><button className="x" onClick={onClose} aria-label="Закрыть">✕</button>{children}</div>
    </div>
  );
}

export function UnitModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { unitMap, rarityColor, catalog, inventory } = useStore();
  const u = unitMap.get(id)!; const c = rarityColor(u.rarity);
  const own = inventory.find((i) => i.unit_id === id)?.qty ?? 0;
  const inCases = catalog.cases.filter((cs) => cs.items.some((i) => i.unit_id === id));
  return (
    <Modal onClose={onClose}>
      <div className="unit-detail" style={{ '--rc': c } as CSSProperties}>
        <div className="big-img"><UnitImg id={id} /></div>
        <h2 style={{ color: c }}>{u.name}</h2>
        <div className="tags"><span className="tag" style={{ borderColor: c, color: c }}>{u.rarity}</span><span className="tag"><Gem n={u.value} full /></span><span className="tag">В инвентаре: {own}</span></div>
        <p className="muted">{u.desc}</p>
        <div className="muted small-t">{inCases.length ? 'Выпадает из: ' + inCases.map((x) => x.name).join(', ') : 'Не выпадает из кейсов — только апгрейд или награда.'}</div>
      </div>
    </Modal>
  );
}

export function useCountUp(target: number, ms = 700) {
  const [v, setV] = useState(target); const from = useRef(target);
  useEffect(() => {
    const start = performance.now(); const a = from.current; let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms); const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(a + (target - a) * e)); if (k < 1) raf = requestAnimationFrame(step); else from.current = target;
    };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export const Btn = ({ children, onClick, disabled, kind = 'primary', busy, className = '', type = 'button' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: 'primary' | 'ghost' | 'danger' | 'gold'; busy?: boolean; className?: string; type?: 'button' | 'submit';
}) => (
  <button type={type} className={`btn ${kind} ${busy ? 'busy' : ''} ${className}`} disabled={disabled || busy} onClick={() => { sfx.click(); onClick?.(); }}>{children}</button>
);

export function Avatar({ unit, nick, size = 40 }: { unit: string | null; nick: string; size?: number }) {
  if (unit) return <img className="avatar" style={{ width: size, height: size }} src={`/unit-img/${unit}.svg`} alt="" />;
  let h = 0; for (const c of nick) h = (h * 31 + c.charCodeAt(0)) % 360;
  return <span className="avatar letter" style={{ width: size, height: size, background: `linear-gradient(135deg,hsl(${h} 70% 50%),hsl(${(h + 60) % 360} 70% 35%))`, fontSize: size * 0.45 }}>{nick[0]?.toUpperCase()}</span>;
}

export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;
export const useAsync = () => {
  const [busy, setBusy] = useState(false);
  const { toast } = useStore();
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (busy) return; setBusy(true);
    try { return await fn(); } catch (e: any) { toast(e.message || 'Ошибка', 'err'); } finally { setBusy(false); }
  };
  return { busy, run };
};
