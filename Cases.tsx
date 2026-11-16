import { useMemo, useState, type CSSProperties } from 'react';
import { post, fmt, pct } from '../api';
import { useStore } from '../store';
import { Btn, Gem, Modal, UnitCard, UnitImg, useAsync } from '../ui/bits';
import { Reel } from '../ui/Reel';
import { sfx, rarityTier } from '../sound';
import type { CaseT } from '../types';

export function CaseCover({ c, onClick }: { c: CaseT; onClick?: () => void }) {
  const { unitMap } = useStore();
  const tops = [...c.items].sort((a, b) => unitMap.get(b.unit_id)!.value - unitMap.get(a.unit_id)!.value).slice(0, 3);
  return (
    <div className={`case-card ${c.enabled ? '' : 'off'}`} style={{ '--cc': c.color } as CSSProperties} onClick={onClick}>
      <div className="case-art">
        <div className="case-glow" />
        {tops.map((t, i) => <UnitImg key={t.unit_id} id={t.unit_id} className={`ca ca${i}`} />)}
        <div className="crate"><span>{c.name.split(' ')[0].toUpperCase()}</span></div>
      </div>
      <div className="case-name">{c.name}</div>
      <div className="muted small-t">{c.tagline}</div>
      <div className="case-price"><Gem n={c.price} /></div>
    </div>
  );
}

export function Cases({ sub }: { sub?: string }) {
  const { catalog, go } = useStore();
  const c = catalog.cases.find((x) => x.id === sub);
  if (c) return <CaseView c={c} />;
  return (
    <div className="page">
      <h1>Кейсы</h1>
      <p className="muted">Шансы выпадения публичны и честно проверяются сервером. Нажмите на кейс, чтобы увидеть содержимое.</p>
      <div className="grid cases">{catalog.cases.map((x) => <CaseCover key={x.id} c={x} onClick={() => go('cases/' + x.id)} />)}</div>
    </div>
  );
}

function CaseView({ c }: { c: CaseT }) {
  const { user, unitMap, catalog, go, toast, setGems, refreshInventory } = useStore();
  const { busy, run } = useAsync();
  const [count, setCount] = useState(1);
  const [drops, setDrops] = useState<{ unit_id: string; value: number }[] | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [doneN, setDoneN] = useState(0);
  const [result, setResult] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const cost = c.price * count;
  const items = useMemo(() => [...c.items], [c]);

  const open = () => run(async () => {
    const r = await post<{ drops: { unit_id: string; value: number }[]; balance: number }>('/api/cases/open', { caseId: c.id, count });
    setDrops(r.drops); setDoneN(0); setResult(false); setSpinning(true); sfx.whoosh();
    // баланс обновляем после окончания анимации
    (window as any).__bal = r.balance;
  });
  const onReelDone = () => setDoneN((n) => {
    const nn = n + 1;
    if (drops && nn >= drops.length) {
      setTimeout(() => {
        const best = Math.max(...drops.map((d) => rarityTier(unitMap.get(d.unit_id)!.rarity)));
        best >= 4 ? sfx.big() : sfx.win(best);
        setGems((window as any).__bal); refreshInventory(); setSpinning(false); setResult(true);
      }, 300);
    }
    return nn;
  });
  const total = drops?.reduce((a, d) => a + d.value, 0) ?? 0;
  const sellAll = () => run(async () => {
    const m = new Map<string, number>(); drops!.forEach((d) => m.set(d.unit_id, (m.get(d.unit_id) ?? 0) + 1));
    const r = await post<{ gained: number; balance: number }>('/api/inventory/sell', { items: [...m].map(([unit_id, qty]) => ({ unit_id, qty })) });
    sfx.coin(); toast(`Продано за ${fmt(r.gained)} гемов`, 'ok'); setGems(r.balance); refreshInventory(); setResult(false); setDrops(null);
  });

  return (
    <div className="page" style={{ '--cc': c.color } as CSSProperties}>
      <button className="back" onClick={() => go('cases')}>← Все кейсы</button>
      <div className="case-head">
        <h1 style={{ color: c.color }}>{c.name}</h1>
        <div className="muted">Ожидаемый возврат: ~{Math.round((c.ev / c.price) * 100)}% · {items.length} юнитов</div>
      </div>

      <div className="card open-box">
        {spinning && drops ? (
          <div className="reels">{drops.map((d, i) => <Reel key={i} pool={items} winner={d.unit_id} cardW={drops.length > 3 ? 84 : 120} delay={i * 150} duration={4400 + i * 120} onDone={onReelDone} />)}</div>
        ) : (
          <div className="open-idle"><div className="case-big"><CaseCover c={c} /></div></div>
        )}
        <div className="open-controls">
          <div className="counter">
            <button disabled={spinning || count <= 1} onClick={() => { sfx.click(); setCount(count - 1); }}>−</button>
            <b>{count}</b>
            <button disabled={spinning || count >= catalog.config.maxOpen} onClick={() => { sfx.click(); setCount(count + 1); }}>+</button>
          </div>
          <Btn kind="gold" onClick={open} busy={busy || spinning} disabled={user.gems < cost || !c.enabled}>
            {!c.enabled ? 'Недоступен' : user.gems < cost ? 'Недостаточно гемов' : <>Открыть {count > 1 ? `×${count}` : ''} · <Gem n={cost} /></>}
          </Btn>
        </div>
      </div>

      <h3>Содержимое кейса</h3>
      <div className="grid units">{items.map((i) => <UnitCard key={i.unit_id} id={i.unit_id} chance={i.chance} onClick={() => setDetail(i.unit_id)} />)}</div>
      {detail && <UnitInfo id={detail} onClose={() => setDetail(null)} chance={items.find((i) => i.unit_id === detail)!.chance} />}

      {result && drops && (
        <Modal onClose={() => setResult(false)} wide>
          <div className="center"><h2>Выпало!</h2>
            <div className="grid units drops">{drops.map((d, i) => <UnitCard key={i} id={d.unit_id} />)}</div>
            <p>Общая стоимость: <Gem n={total} full /></p>
            <div className="row center"><Btn kind="ghost" onClick={sellAll} busy={busy}>Продать всё за {fmt(Math.floor(total * catalog.config.sellRate))}</Btn><Btn onClick={() => setResult(false)}>Оставить</Btn></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function UnitInfo({ id, chance, onClose }: { id: string; chance: number; onClose: () => void }) {
  const { unitMap } = useStore(); const u = unitMap.get(id)!;
  return (
    <Modal onClose={onClose}><div className="center"><div className="big-img"><UnitImg id={id} /></div><h2>{u.name}</h2><p className="muted">{u.desc}</p>
      <div className="tags"><span className="tag">{u.rarity}</span><span className="tag"><Gem n={u.value} full /></span><span className="tag">Шанс {pct(chance)}</span></div></div></Modal>
  );
}
