import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { get, post, pct, timeAgo } from '../api';
import { useStore } from '../store';
import { Btn, Empty, Gem, UnitCard, UnitImg, useAsync } from '../ui/bits';
import { sfx } from '../sound';

interface Hist { id: number; ts: number; input_value: number; inputs: { unit_id: string; qty: number }[]; target_unit: string; chance: number; success: boolean }

export function Upgrader() {
  const { inventory, unitMap, catalog, toast, refresh, refreshInventory, rarityColor } = useStore();
  const { busy, run } = useAsync();
  const [sel, setSel] = useState<Record<string, number>>(() => {
    try { const s = JSON.parse(sessionStorage.getItem('tg_up_sel') || '[]'); sessionStorage.removeItem('tg_up_sel'); return Object.fromEntries(s.map((i: any) => [i.unit_id, i.qty])); } catch { return {}; }
  });
  const [target, setTarget] = useState<string | null>(null);
  const [rot, setRot] = useState(0); const [anim, setAnim] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'spin' | 'win' | 'lose'>('idle');
  const [hist, setHist] = useState<Hist[]>([]);
  const wheelRef = useRef<SVGGElement>(null);

  const loadHist = () => get<{ items: Hist[] }>('/api/upgrade/history').then((r) => setHist(r.items)).catch(() => {});
  useEffect(() => { loadHist(); }, []);

  const inputs = Object.entries(sel).filter(([, q]) => q > 0).map(([unit_id, qty]) => ({ unit_id, qty }));
  const V = inputs.reduce((a, i) => a + unitMap.get(i.unit_id)!.value * i.qty, 0);
  const cfg = catalog.config;
  const chanceFor = (t: number) => Math.min(cfg.upgradeMaxChance, (cfg.upgradeRtp * V) / t);
  const targets = useMemo(() => catalog.units.filter((u) => u.value > V && V > 0 && chanceFor(u.value) >= cfg.upgradeMinChance).sort((a, b) => a.value - b.value), [catalog, V]); // eslint-disable-line
  const tu = target ? unitMap.get(target) : null;
  const valid = !!tu && tu.value > V && V > 0 && chanceFor(tu.value) >= cfg.upgradeMinChance;
  const chance = valid ? chanceFor(tu!.value) : 0;
  useEffect(() => { if (target && !valid && phase === 'idle') setTarget(null); }, [valid, target, phase]);

  const invQty = (id: string) => inventory.find((i) => i.unit_id === id)?.qty ?? 0;
  const add = (id: string) => { if (phase === 'spin') return; sfx.click(); setSel((s) => ({ ...s, [id]: Math.min(invQty(id), (s[id] ?? 0) + 1) })); };
  const rem = (id: string) => { sfx.click(); setSel((s) => ({ ...s, [id]: Math.max(0, (s[id] ?? 0) - 1) })); };

  const R = 96, C = 2 * Math.PI * R;
  const start = () => run(async () => {
    const r = await post<{ success: boolean; roll: number; chance: number }>('/api/upgrade', { inputs, target });
    setPhase('spin'); sfx.whoosh();
    setAnim(false); setRot(0);
    requestAnimationFrame(() => requestAnimationFrame(() => { setAnim(true); setRot(360 * 6 + r.roll * 360); }));
    let ticks = 0; const iv = setInterval(() => { sfx.tick(); if (++ticks > 34) clearInterval(iv); }, 150);
    setTimeout(async () => {
      clearInterval(iv);
      setPhase(r.success ? 'win' : 'lose'); r.success ? sfx.big() : sfx.lose();
      await Promise.all([refresh(), refreshInventory()]); loadHist();
      toast(r.success ? `Успех! Получен ${tu!.name}` : 'Неудача — юниты потеряны', r.success ? 'ok' : 'err');
    }, 5300);
  });
  const reset = () => { setPhase('idle'); setSel({}); setTarget(null); setAnim(false); setRot(0); };
  const ringColor = tu ? rarityColor(tu.rarity) : '#38bdf8';

  return (
    <div className="page">
      <h1>Апгрейдер</h1>
      <p className="muted">Выберите юниты, затем цель подороже. Шанс = {Math.round(cfg.upgradeRtp * 100)}% × (стоимость юнитов ÷ стоимость цели), максимум {Math.round(cfg.upgradeMaxChance * 100)}%. Результат определяет сервер.</p>
      <div className="up-layout">
        <section className="card up-col">
          <h3>1. Ваши юниты</h3>
          {inventory.length === 0 ? <Empty>Нет юнитов</Empty> : (
            <div className="grid units mini">{[...inventory].sort((a, b) => unitMap.get(b.unit_id)!.value - unitMap.get(a.unit_id)!.value).map((i) => (
              <UnitCard key={i.unit_id} id={i.unit_id} small qty={i.qty - (sel[i.unit_id] ?? 0)} selected={!!sel[i.unit_id]} onClick={() => (i.qty - (sel[i.unit_id] ?? 0) > 0 ? add(i.unit_id) : undefined)} />
            ))}</div>
          )}
        </section>

        <section className={`card machine ${phase}`}>
          <div className="wheel-wrap">
            <svg viewBox="0 0 260 260" className="wheel">
              <defs><filter id="g"><feGaussianBlur stdDeviation="4" /></filter></defs>
              <circle cx="130" cy="130" r={R} fill="none" stroke="#3b1226" strokeWidth="24" />
              <circle cx="130" cy="130" r={R} fill="none" stroke="#22c55e" strokeWidth="24" strokeDasharray={`${C * chance} ${C}`} transform="rotate(-90 130 130)" style={{ filter: 'drop-shadow(0 0 6px #22c55e)', transition: 'stroke-dasharray .4s' }} />
              <circle cx="130" cy="130" r={R + 16} fill="none" stroke={ringColor} strokeOpacity=".5" strokeWidth="2" strokeDasharray="4 8" className="ring-spin" />
              <g ref={wheelRef} style={{ transformOrigin: '130px 130px', transform: `rotate(${rot}deg)`, transition: anim ? 'transform 5s cubic-bezier(.1,.7,.1,1)' : 'none' }}>
                <polygon points="120,6 140,6 130,34" fill="#fff" stroke="#0a0818" strokeWidth="2" strokeLinejoin="round" />
              </g>
            </svg>
            <div className="wheel-center">
              {phase === 'win' && tu ? <UnitImg id={tu.id} className="pop" /> : phase === 'lose' ? <span className="big-x">✕</span> : (
                <><b>{valid ? pct(chance) : '—'}</b><small>шанс успеха</small></>
              )}
            </div>
          </div>
          <div className="up-summary">
            <div><small>Ваши юниты</small><Gem n={V} full /></div>
            <div className="arrow">➜</div>
            <div><small>Цель</small>{tu ? <Gem n={tu.value} full /> : '—'}</div>
          </div>
          {inputs.length > 0 && <div className="chosen">{inputs.map((i) => <div key={i.unit_id} className="chosen-it" onClick={() => phase === 'idle' && rem(i.unit_id)} title="Убрать"><UnitImg id={i.unit_id} />{i.qty > 1 && <b>×{i.qty}</b>}</div>)}</div>}
          {phase === 'win' && <div className="res win">Успех! Вы получили {tu?.name}</div>}
          {phase === 'lose' && <div className="res lose">Не повезло… Выпало {Math.round(rot % 360 / 3.6 * 10) / 10}% — нужно было до {pct(chance)}</div>}
          {phase === 'win' || phase === 'lose' ? <Btn onClick={reset}>Ещё раз</Btn>
            : <Btn kind="gold" onClick={start} busy={busy || phase === 'spin'} disabled={!valid}>{valid ? `Улучшить · шанс ${pct(chance)}` : V === 0 ? 'Выберите юниты' : 'Выберите цель'}</Btn>}
        </section>

        <section className="card up-col">
          <h3>2. Цель</h3>
          {V === 0 ? <Empty>Сначала выберите юниты</Empty> : targets.length === 0 ? <Empty>Нет доступных целей</Empty> : (
            <div className="targets">{targets.map((u) => (
              <div key={u.id} className={`target ${target === u.id ? 'sel' : ''}`} style={{ '--rc': rarityColor(u.rarity) } as CSSProperties} onClick={() => phase === 'idle' && (sfx.click(), setTarget(u.id))}>
                <UnitImg id={u.id} /><div className="t-info"><b>{u.name}</b><small>{u.rarity}</small></div><div className="t-right"><Gem n={u.value} /><span className="t-chance">{pct(chanceFor(u.value))}</span></div>
              </div>
            ))}</div>
          )}
        </section>
      </div>

      <h3>История апгрейдов</h3>
      {hist.length === 0 ? <Empty>Пока пусто</Empty> : (
        <div className="list">{hist.map((h) => (
          <div key={h.id} className={`list-row ${h.success ? 'ok' : 'bad'}`}>
            <span>{timeAgo(h.ts)}</span><span>{h.inputs.map((i) => `${unitMap.get(i.unit_id)?.name}${i.qty > 1 ? ' ×' + i.qty : ''}`).join(', ')} → <b>{unitMap.get(h.target_unit)?.name}</b></span>
            <span>{pct(h.chance)}</span><b>{h.success ? 'Успех' : 'Провал'}</b>
          </div>
        ))}</div>
      )}
    </div>
  );
}
