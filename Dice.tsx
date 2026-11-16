import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { get, post, pct, timeAgo, fmt } from '../api';
import { useStore } from '../store';
import { Btn, Empty, Gem, useAsync } from '../ui/bits';
import { sfx } from '../sound';

interface Col { id: string; label: string; hex: string; weight: number; chance: number }
interface Info { colors: Col[]; table: Record<string, { k: number; matchProb: number[]; perMatch: number; tripleBonus: number; burstPerDie: number; goldenStorm: number }>; minBet: number; maxBet: number; rtp: number }
interface Res { dice: string[]; matches: number; effects: string[]; payout: number; bet: number; balance: number }
const EFF: Record<string, string> = { triple: '🔥 ТРОЙНОЕ СОВПАДЕНИЕ', rainbow_burst: '🌈 РАДУЖНЫЙ ВЗРЫВ', golden_storm: '⚡ ЗОЛОТАЯ БУРЯ' };

export function Dice() {
  const { user, setGems, toast } = useStore();
  const { busy, run } = useAsync();
  const [info, setInfo] = useState<Info | null>(null);
  const [color, setColor] = useState('red'); const [bet, setBet] = useState(100);
  const [faces, setFaces] = useState<string[]>(['red', 'blue', 'green']);
  const [state, setState] = useState<'idle' | 'rolling' | 'landed'>('idle');
  const [landed, setLanded] = useState<boolean[]>([false, false, false]);
  const [res, setRes] = useState<Res | null>(null);
  const [hist, setHist] = useState<any[]>([]);
  const [showTable, setShowTable] = useState(false);
  const iv = useRef<number>(0);
  const landedRef = useRef<boolean[]>([false, false, false]);

  const loadHist = () => get('/api/dice/history').then((r) => setHist(r.items)).catch(() => {});
  useEffect(() => { get<Info>('/api/dice').then(setInfo); loadHist(); return () => clearInterval(iv.current); }, []);
  if (!info) return <div className="page"><div className="spinner" /></div>;
  const col = (id: string) => info.colors.find((c) => c.id === id)!;
  const row = info.table[color];
  const clampBet = (n: number) => Math.max(info.minBet, Math.min(info.maxBet, Math.floor(n) || info.minBet));

  const roll = () => run(async () => {
    setState('rolling'); setRes(null); setLanded([false, false, false]); landedRef.current = [false, false, false]; sfx.roll();
    clearInterval(iv.current);
    iv.current = window.setInterval(() => setFaces((prev) => prev.map((f, j) => (landedRef.current[j] ? f : info.colors[Math.floor(Math.random() * 6)].id))), 90);
    let r: Res;
    try { r = await post<Res>('/api/dice/roll', { color, bet }); } catch (e) { clearInterval(iv.current); setState('idle'); throw e; }
    await new Promise((ok) => setTimeout(ok, 900));
    for (let i = 0; i < 3; i++) {
      await new Promise((ok) => setTimeout(ok, 450));
      landedRef.current[i] = true;
      setFaces((f) => f.map((x, j) => (j === i ? r.dice[i] : x)));
      setLanded((l) => l.map((x, j) => (j <= i ? true : x))); sfx.click();
      if (i === 2) clearInterval(iv.current);
      else if (i < 2) { /* остальные ещё крутятся */ }
    }
    clearInterval(iv.current); setFaces(r.dice);
    setRes(r); setState('landed'); setGems(r.balance); loadHist();
    if (r.effects.length) sfx.big(); else if (r.payout >= r.bet) sfx.win(1); else if (r.payout > 0) sfx.coin(); else sfx.lose();
    if (r.payout > 0) toast(`+${fmt(r.payout)} гемов`, 'ok');
  });

  return (
    <div className="page">
      <h1>Color Dice</h1>
      <p className="muted">Выберите цвет и ставку. Бросаются три кубика — каждый совпавший кубик платит. 🌈 Радужный — джокер. Возврат игроку: {Math.round(info.rtp * 100)}%.</p>
      <div className="dice-layout">
        <section className="card dice-stage">
          <div className={`dice-row ${state}`}>
            {faces.map((f, i) => (
              <div key={i} className={`die ${landed[i] ? 'landed' : ''} ${f === 'rainbow' ? 'rb' : ''} ${res && (f === color || f === 'rainbow' && color !== 'rainbow') ? 'hit' : ''}`} style={{ '--dc': col(f).hex, animationDelay: `${i * 0.12}s` } as CSSProperties}>
                <span className="pips">{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((p) => <i key={p} className={[0, 2, 4, 6, 8].includes(p) ? 'on' : ''} />)}</span>
              </div>
            ))}
          </div>
          <div className="dice-result">
            {res ? (
              <div className={res.payout > 0 ? 'win-txt' : 'lose-txt'}>
                {res.effects.map((e) => <div key={e} className="effect">{EFF[e]}</div>)}
                {res.payout > 0 ? <>Выигрыш: <Gem n={res.payout} full /> ({res.matches} совп.)</> : 'Не повезло — попробуйте ещё'}
              </div>
            ) : <span className="muted">{state === 'rolling' ? 'Кубики летят…' : 'Сделайте бросок'}</span>}
          </div>
        </section>

        <section className="card">
          <h3>Ваш цвет</h3>
          <div className="color-pick">
            {info.colors.map((c) => (
              <button key={c.id} className={`cbtn ${color === c.id ? 'on' : ''} ${c.id === 'rainbow' ? 'rb' : ''}`} style={{ '--dc': c.hex } as CSSProperties} onClick={() => { sfx.click(); setColor(c.id); }} disabled={state === 'rolling'}>
                <span className="dot" /><b>{c.label}</b><small>{pct(c.chance)} · ×{info.table[c.id].perMatch.toFixed(2)}</small>
              </button>
            ))}
          </div>
          <h3>Ставка</h3>
          <div className="bet-row">
            <input type="number" value={bet} min={info.minBet} max={info.maxBet} onChange={(e) => setBet(Number(e.target.value))} onBlur={() => setBet(clampBet(bet))} />
            {[10, 100, 1000].map((n) => <button key={n} className="chip-btn" onClick={() => setBet(clampBet(n))}>{n}</button>)}
            <button className="chip-btn" onClick={() => setBet(clampBet(bet / 2))}>½</button>
            <button className="chip-btn" onClick={() => setBet(clampBet(bet * 2))}>×2</button>
            <button className="chip-btn" onClick={() => setBet(clampBet(Math.min(user.gems, info.maxBet)))}>MAX</button>
          </div>
          <div className="muted small-t">За каждое совпадение: ×{row.perMatch.toFixed(2)} · тройка: +×{row.tripleBonus.toFixed(2)} · радужный взрыв: +×{row.burstPerDie.toFixed(2)} за кубик</div>
          <Btn kind="gold" className="wide" busy={busy || state === 'rolling'} disabled={user.gems < bet || bet < info.minBet} onClick={roll}>{user.gems < bet ? 'Недостаточно гемов' : <>Бросить · <Gem n={bet} /></>}</Btn>
        </section>
      </div>

      <div className="card">
        <div className="card-head"><h3>Таблица вероятностей</h3><button className="link" onClick={() => setShowTable(!showTable)}>{showTable ? 'Скрыть' : 'Показать'}</button></div>
        {showTable && (
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Цвет</th><th>0</th><th>1</th><th>2</th><th>3</th><th>За совп.</th><th>Тройка</th></tr></thead>
            <tbody>{info.colors.map((c) => { const t = info.table[c.id]; return (
              <tr key={c.id}><td><i className="dot" style={{ background: c.hex }} /> {c.label}</td>{t.matchProb.map((p, i) => <td key={i}>{pct(p)}</td>)}<td>×{t.perMatch.toFixed(2)}</td><td>+×{t.tripleBonus.toFixed(2)}</td></tr>
            ); })}</tbody>
          </table></div>
        )}
        <div className="muted small-t">Редкие эффекты: 🌈 Радужный взрыв (любой радужный кубик), ⚡ Золотая буря (3 золотых кубика). Колонки 0–3 — вероятность числа совпадений.</div>
      </div>

      <h3>История бросков</h3>
      {hist.length === 0 ? <Empty>Бросков ещё не было</Empty> : (
        <div className="list">{hist.map((h) => (
          <div key={h.id} className={`list-row ${h.payout > 0 ? 'ok' : 'bad'}`}>
            <span>{timeAgo(h.ts)}</span>
            <span className="dots">{h.dice.map((d: string, i: number) => <i key={i} className="dot" style={{ background: col(d).hex }} />)} <small>ваш: {col(h.color).label}</small></span>
            <span>Ставка {fmt(h.bet)}</span><b>{h.payout > 0 ? '+' + fmt(h.payout) : '0'}</b>
          </div>
        ))}</div>
      )}
    </div>
  );
}
