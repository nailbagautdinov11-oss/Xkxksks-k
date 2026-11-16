import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { get, post, fmt, timeAgo } from '../api';
import { useStore } from '../store';
import { Avatar, Btn, Empty, Gem, Modal, UnitCard, useAsync } from '../ui/bits';
import { Reel } from '../ui/Reel';
import { sfx } from '../sound';
import type { Battle } from '../types';

const MODE: Record<string, string> = { '1v1': '1 на 1', '2v2': '2 на 2', ffa: 'Каждый сам за себя' };
const STATUS: Record<string, string> = { waiting: 'Ожидание', starting: 'Старт…', running: 'Идёт бой', done: 'Завершён', cancelled: 'Отменён' };

export function Battles({ sub }: { sub?: string }) {
  return sub ? <Room id={Number(sub)} /> : <Lobby />;
}

function Lobby() {
  const { catalog, go, onWs, toast, refresh, user } = useStore();
  const { busy, run } = useAsync();
  const [data, setData] = useState<{ open: Battle[]; history: Battle[] } | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => get('/api/battles').then(setData).catch(() => {}), []);
  useEffect(() => { load(); return onWs((m) => (m.t === 'lobby' || m.t === 'battle') && load()); }, [load, onWs]);

  const join = (b: Battle, team?: number) => run(async () => { await post(`/api/battles/${b.id}/join`, { team }); await refresh(); go('battles/' + b.id); });

  return (
    <div className="page">
      <div className="row between"><h1>Батлы</h1><Btn kind="gold" onClick={() => setCreating(true)}>+ Создать комнату</Btn></div>
      <p className="muted">Все открывают одинаковые кейсы. Побеждает тот, чьи юниты дороже — победитель забирает все выпавшие юниты. Взнос = цена кейсов.</p>
      {!data ? <div className="spinner" /> : data.open.length === 0 ? <Empty>Открытых комнат нет — создайте свою!</Empty> : (
        <div className="grid rooms">{data.open.map((b) => {
          const mine = b.players.some((p) => p.userId === user.id);
          return (
            <div key={b.id} className="card room-card" style={{ '--cc': b.caseColor } as CSSProperties}>
              <div className="row between"><b>#{b.id} · {b.caseName}</b><span className={`st ${b.status}`}>{STATUS[b.status]}</span></div>
              <div className="muted">{MODE[b.mode]} · {b.rounds} раунд(ов)</div>
              <div className="slots">{Array.from({ length: b.maxPlayers }).map((_, i) => { const p = b.players.find((x) => x.slot === i); return p ? <Avatar key={i} unit={p.avatarUnit} nick={p.nick} size={32} /> : <span key={i} className="slot-empty">?</span>; })}</div>
              <div className="row between"><span>Взнос <Gem n={b.entry} /></span>
                {mine || b.status !== 'waiting' ? <Btn kind="ghost" onClick={() => go('battles/' + b.id)}>{mine ? 'В комнату' : 'Смотреть'}</Btn>
                  : <Btn busy={busy} disabled={user.gems < b.entry} onClick={() => join(b)}>Войти</Btn>}</div>
            </div>
          );
        })}</div>
      )}
      <h3>Мои бои</h3>
      {!data || data.history.length === 0 ? <Empty>Вы ещё не участвовали в батлах</Empty> : <History list={data.history} />}
      {creating && <Create onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); refresh(); go('battles/' + id); }} toast={toast} caseList={catalog.cases} />}
    </div>
  );
}

export function History({ list }: { list: Battle[] }) {
  const { user, go } = useStore();
  return (
    <div className="list">{list.map((b) => {
      const me = b.players.find((p) => p.userId === user.id);
      const o = b.status === 'cancelled' ? 'cancel' : me?.outcome;
      const total = b.rolls.flat().filter((d) => d.slot === me?.slot).reduce((a, d) => a + d.value, 0);
      return (
        <div key={b.id} className={`list-row clickable ${o === 'win' ? 'ok' : o === 'lose' ? 'bad' : ''}`} onClick={() => go('battles/' + b.id)}>
          <span>{timeAgo(b.finishedAt ?? b.createdAt)}</span><span>#{b.id} {b.caseName} · {MODE[b.mode]} · {b.rounds}×</span>
          <span>{b.status === 'done' ? <>Ваш итог <Gem n={total} /></> : 'Отменён'}</span>
          <b>{o === 'win' ? 'Победа' : o === 'lose' ? 'Поражение' : o === 'draw' ? 'Ничья' : '—'}</b>
        </div>
      );
    })}</div>
  );
}

function Create({ onClose, onCreated, toast, caseList }: { onClose: () => void; onCreated: (id: number) => void; toast: any; caseList: any[] }) {
  const { user } = useStore();
  const { busy, run } = useAsync();
  const [mode, setMode] = useState('1v1'); const [players, setPlayers] = useState(3);
  const [caseId, setCaseId] = useState(caseList[0].id); const [rounds, setRounds] = useState(3);
  const c = caseList.find((x) => x.id === caseId); const entry = c.price * rounds;
  const submit = () => run(async () => { const r = await post<{ id: number }>('/api/battles/create', { mode, players, caseId, rounds }); sfx.win(1); onCreated(r.id); });
  return (
    <Modal onClose={onClose}>
      <h2>Новая комната</h2>
      <div className="form">
        <label>Режим<div className="chips">{Object.entries(MODE).map(([k, v]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{v}</button>)}</div></label>
        {mode === 'ffa' && <label>Игроков: {players}<input type="range" min={3} max={6} value={players} onChange={(e) => setPlayers(+e.target.value)} /></label>}
        <label>Кейс<select value={caseId} onChange={(e) => setCaseId(e.target.value)}>{caseList.filter((x) => x.enabled).map((x) => <option key={x.id} value={x.id}>{x.name} — {fmt(x.price)}</option>)}</select></label>
        <label>Раундов (кейсов на игрока): {rounds}<input type="range" min={1} max={10} value={rounds} onChange={(e) => setRounds(+e.target.value)} /></label>
        <div className="row between">Взнос с каждого: <Gem n={entry} full /></div>
        <Btn kind="gold" className="wide" busy={busy} disabled={user.gems < entry} onClick={submit}>{user.gems < entry ? 'Недостаточно гемов' : 'Создать комнату'}</Btn>
      </div>
    </Modal>
  );
}

function Room({ id }: { id: number }) {
  const { user, go, onWs, refresh, refreshInventory, catalog, unitMap, toast } = useStore();
  const { busy, run } = useAsync();
  const [b, setB] = useState<Battle | null>(null);
  const [err, setErr] = useState('');
  const [anim, setAnim] = useState<number | null>(null);
  const prev = useRef<{ revealed: number; status: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const nb = await get<Battle>(`/api/battles/${id}`);
      const p = prev.current;
      if (p && nb.status === 'running' && nb.revealed > p.revealed) { setAnim(nb.revealed - 1); sfx.whoosh(); setTimeout(() => setAnim((a) => (a === nb.revealed - 1 ? null : a)), 4300); }
      if (p && p.status !== 'done' && nb.status === 'done') { refresh(); refreshInventory(); const me = nb.players.find((x) => x.userId === user.id); me?.outcome === 'win' ? sfx.big() : me?.outcome === 'lose' ? sfx.lose() : sfx.win(1); }
      if (p && p.status !== 'cancelled' && nb.status === 'cancelled') refresh();
      prev.current = { revealed: nb.revealed, status: nb.status };
      setB(nb);
    } catch (e: any) { setErr(e.message); }
  }, [id, refresh, refreshInventory, user.id]);
  useEffect(() => { prev.current = null; load(); return onWs((m) => m.t === 'battle' && m.id === id && load()); }, [id, load, onWs]);

  if (err) return <div className="page"><button className="back" onClick={() => go('battles')}>← Назад</button><Empty>{err}</Empty></div>;
  if (!b) return <div className="page"><div className="spinner" /></div>;

  const me = b.players.find((p) => p.userId === user.id);
  const isCreator = b.creatorId === user.id;
  const pool = catalog.cases.find((c) => c.id === b.caseId)?.items ?? [];
  const act = (path: string, body?: any, back = false) => run(async () => { await post(`/api/battles/${b.id}/${path}`, body); await refresh(); if (back) go('battles'); else load(); });
  const totalOf = (slot: number) => b.rolls.reduce((a, r, i) => a + (i === anim ? 0 : r.find((d) => d.slot === slot)?.value ?? 0), 0);
  const teams = b.mode === '2v2' ? [0, 1] : [];
  const shown = b.status === 'running' || b.status === 'done';
  const finished = b.status === 'done' && anim === null;

  const slotCard = (i: number) => {
    const p = b.players.find((x) => x.slot === i);
    if (!p) {
      return (
        <div key={i} className="pl empty">
          <div className="slot-empty big">?</div><div className="muted">Свободно</div>
          {b.status === 'waiting' && !me && <Btn busy={busy} disabled={user.gems < b.entry} onClick={() => act('join', { team: b.mode === '2v2' ? i % 2 : undefined })}>Войти</Btn>}
          {b.status === 'waiting' && isCreator && <Btn kind="ghost" busy={busy} disabled={user.gems < b.entry} onClick={() => act('bot')}>+ Бот (взнос {fmt(b.entry)})</Btn>}
        </div>
      );
    }
    const won = finished && p.outcome === 'win';
    return (
      <div key={i} className={`pl ${won ? 'winner' : ''} ${finished && p.outcome === 'lose' ? 'loser' : ''} ${p.userId === user.id ? 'me' : ''}`}>
        {won && <div className="crown">👑</div>}
        <Avatar unit={p.avatarUnit} nick={p.nick} size={52} />
        <b>{p.nick}{p.isBot ? ' 🤖' : ''}</b>
        {shown && <Gem n={totalOf(p.slot)} className="ptotal" />}
        {finished && <div className={`outcome ${p.outcome}`}>{p.outcome === 'win' ? 'ПОБЕДА' : p.outcome === 'draw' ? 'НИЧЬЯ' : 'ПОРАЖЕНИЕ'}</div>}
        {shown && (
          <div className="drops-col">{b.rolls.map((r, ri) => {
            const d = r.find((x) => x.slot === p.slot)!;
            return ri === anim ? <Reel key={'a' + ri} pool={pool} winner={d.unit_id} cardW={92} duration={3500} /> : <UnitCard key={ri} id={d.unit_id} small />;
          })}</div>
        )}
      </div>
    );
  };

  return (
    <div className="page" style={{ '--cc': b.caseColor } as CSSProperties}>
      <button className="back" onClick={() => go('battles')}>← Все батлы</button>
      <div className="card room-head">
        <div><h2>Баттл #{b.id} · {b.caseName}</h2><div className="muted">{MODE[b.mode]} · {b.rounds} раунд(ов) · взнос <Gem n={b.entry} /></div></div>
        <div className={`st big ${b.status}`}>
          {b.status === 'waiting' && `Ждём игроков ${b.players.length}/${b.maxPlayers}`}
          {b.status === 'starting' && 'Все в сборе! Старт через мгновение…'}
          {b.status === 'running' && `Раунд ${Math.max(1, b.revealed)} из ${b.rounds}`}
          {b.status === 'done' && (b.result?.draw ? 'Ничья' : 'Бой завершён')}
          {b.status === 'cancelled' && 'Комната отменена, взносы возвращены'}
        </div>
      </div>
      {teams.length ? (
        <div className="teams">{teams.map((t) => <div key={t} className="team"><h4>Команда {t ? 'B' : 'A'}</h4><div className="players">{Array.from({ length: b.maxPlayers }, (_, i) => i).filter((i) => i % 2 === t).map(slotCard)}</div></div>)}</div>
      ) : <div className="players">{Array.from({ length: b.maxPlayers }, (_, i) => slotCard(i))}</div>}

      {finished && b.result && (
        <div className="card result-box">
          <h3>{b.result.draw ? 'Ничья — каждый забирает свои юниты' : 'Победитель забирает все юниты'}</h3>
          {b.players.filter((p) => (b.result!.gets[p.slot] ?? []).length > 0).map((p) => (
            <div key={p.slot} className="get-row"><b>{p.nick}{p.isBot ? ' 🤖' : ''}</b><div className="mini-drops">{b.result!.gets[p.slot].map((d, i) => <UnitCard key={i} id={d.unit_id} small />)}</div></div>
          ))}
          {me?.outcome === 'win' && <p className="win-txt">Бонус за победу: +<Gem n={Math.round(b.entry * 0.05)} /></p>}
        </div>
      )}
      <div className="row center">
        {b.status === 'waiting' && me && <Btn kind="danger" busy={busy} onClick={() => act('leave', {}, true)}>{isCreator ? 'Закрыть комнату' : 'Выйти'}</Btn>}
        {(b.status === 'done' || b.status === 'cancelled') && <Btn onClick={() => go('battles')}>К списку батлов</Btn>}
      </div>
    </div>
  );
}
