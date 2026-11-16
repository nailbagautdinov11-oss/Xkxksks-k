import { useEffect, useRef, useState } from 'react';
import { get, post, fmt, timeAgo, fmtFull } from '../api';
import { useStore } from '../store';
import { Btn, Empty, Gem, Modal, UnitImg, useAsync } from '../ui/bits';
import { WD_STATUS, slotText } from './Withdraw';

const TABS = ['Выводы', 'Игроки', 'Кейсы', 'Объявления', 'Журнал', 'Картинки'] as const;

export function Admin() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Выводы');
  return (
    <div className="page">
      <h1>Админ-панель</h1>
      <p className="muted">Доступ проверяется сервером по базе данных. Все действия записываются в журнал.</p>
      <div className="chips">{TABS.map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'Выводы' && <Withdrawals />}{tab === 'Игроки' && <Players />}{tab === 'Кейсы' && <CasesAdmin />}{tab === 'Объявления' && <Announce />}{tab === 'Журнал' && <Log />}{tab === 'Картинки' && <Images />}
    </div>
  );
}

function Players() {
  const { toast, catalog, refresh } = useStore();
  const { busy, run } = useAsync();
  const [q, setQ] = useState(''); const [items, setItems] = useState<any[]>([]);
  const [target, setTarget] = useState<any>(null); const [amount, setAmount] = useState(1000); const [reason, setReason] = useState('');
  const [unit, setUnit] = useState(catalog.units[0].id); const [qty, setQty] = useState(1);
  const load = () => get('/api/admin/users?q=' + encodeURIComponent(q)).then((r) => { setItems(r.items); if (target) setTarget(r.items.find((x: any) => x.id === target.id) ?? null); });
  useEffect(() => { load(); }, []); // eslint-disable-line
  const act = (fn: () => Promise<any>, msg: string) => run(async () => { await fn(); toast(msg, 'ok'); await load(); refresh(); });
  return (
    <div>
      <div className="toolbar"><input placeholder="Поиск по нику" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} /><Btn onClick={load}>Найти</Btn></div>
      <div className="table-wrap"><table className="tbl">
        <thead><tr><th>ID</th><th>Ник</th><th>Гемы</th><th>Юниты</th><th>Стоимость</th><th>П/Пор</th><th>Статус</th><th /></tr></thead>
        <tbody>{items.map((u) => (
          <tr key={u.id}><td>{u.id}</td><td>{u.nick}{u.is_admin ? ' 🛠️' : ''}</td><td>{fmtFull(u.gems)}</td><td>{u.units}</td><td>{fmt(u.worth)}</td><td>{u.wins}/{u.losses}</td><td>{u.banned ? '⛔ бан' : 'ок'}</td>
            <td><Btn kind="ghost" onClick={() => setTarget(u)}>Управлять</Btn></td></tr>
        ))}</tbody>
      </table></div>
      {target && (
        <Modal onClose={() => setTarget(null)}>
          <h2>{target.nick}</h2><div className="muted">Баланс: <Gem n={target.gems} full /></div>
          <div className="form">
            <label>Количество гемов (минус — снять)<input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></label>
            <label>Причина<input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={100} /></label>
            <Btn busy={busy} onClick={() => act(() => post('/api/admin/gems', { userId: target.id, amount, reason }), amount > 0 ? 'Гемы выданы' : 'Гемы сняты')}>{amount >= 0 ? 'Выдать гемы' : 'Снять гемы'}</Btn>
            <label>Юнит<select value={unit} onChange={(e) => setUnit(e.target.value)}>{catalog.units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.rarity})</option>)}</select></label>
            <label>Количество<input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></label>
            <Btn busy={busy} onClick={() => act(() => post('/api/admin/give-unit', { userId: target.id, unit_id: unit, qty }), 'Юнит выдан')}>Выдать юнит</Btn>
            {!target.is_admin && (target.banned
              ? <Btn kind="gold" busy={busy} onClick={() => act(() => post('/api/admin/ban', { userId: target.id, banned: false }), 'Разблокирован')}>Разблокировать</Btn>
              : <Btn kind="danger" busy={busy} onClick={() => act(() => post('/api/admin/ban', { userId: target.id, banned: true, reason: reason || 'нарушение правил' }), 'Заблокирован')}>Заблокировать</Btn>)}
          </div>
        </Modal>
      )}
    </div>
  );
}

function CasesAdmin() {
  const { catalog, unitMap, toast } = useStore();
  const { busy, run } = useAsync();
  const [list, setList] = useState<any[]>([]); const [edit, setEdit] = useState<any>(null);
  const load = () => get('/api/admin/cases').then((r) => setList(r.items));
  useEffect(() => { load(); }, []);
  const save = (c: any) => run(async () => {
    const r = await post('/api/admin/case', { id: c.id, name: c.name, price: Number(c.price), enabled: c.enabled, color: c.color, tagline: c.tagline, items: c.items.map((i: any) => ({ unit_id: i.unit_id, weight: Number(i.weight) })) });
    toast(`Сохранено. Матожидание: ${fmt(r.ev)} гемов`, 'ok'); setEdit(null); load();
  });
  const startNew = () => setEdit({ id: '', name: '', price: 100, enabled: false, color: '#38bdf8', tagline: '', items: [{ unit_id: catalog.units[0].id, weight: 1000 }], isNew: true });
  const totalW = edit ? edit.items.reduce((a: number, i: any) => a + Number(i.weight || 0), 0) : 0;
  return (
    <div>
      <div className="row between"><span className="muted">Шанс юнита = вес ÷ сумма весов. Цена должна быть выше матожидания, иначе игроки будут получать гемы «из воздуха».</span><Btn onClick={startNew}>+ Новый кейс</Btn></div>
      <div className="table-wrap"><table className="tbl"><thead><tr><th>Кейс</th><th>Цена</th><th>Матожидание</th><th>Возврат</th><th>Вкл.</th><th /></tr></thead>
        <tbody>{list.map((c) => <tr key={c.id}><td>{c.name}</td><td>{fmtFull(c.price)}</td><td>{fmtFull(c.ev)}</td><td style={{ color: c.ev > c.price ? '#f87171' : undefined }}>{Math.round((c.ev / c.price) * 100)}%</td><td>{c.enabled ? '✓' : '—'}</td><td><Btn kind="ghost" onClick={() => setEdit(JSON.parse(JSON.stringify(c)))}>Править</Btn></td></tr>)}</tbody></table></div>
      {edit && (
        <Modal wide onClose={() => setEdit(null)}>
          <h2>{edit.isNew ? 'Новый кейс' : edit.name}</h2>
          <div className="form two">
            <label>ID (a-z, 0-9, -)<input disabled={!edit.isNew} value={edit.id} onChange={(e) => setEdit({ ...edit, id: e.target.value })} /></label>
            <label>Название<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <label>Цена<input type="number" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></label>
            <label>Цвет<input type="color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} /></label>
            <label>Подпись<input value={edit.tagline} onChange={(e) => setEdit({ ...edit, tagline: e.target.value })} /></label>
            <label className="check"><input type="checkbox" checked={edit.enabled} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} /> Включён</label>
          </div>
          <h4>Юниты и веса</h4>
          <div className="items-edit">{edit.items.map((it: any, i: number) => (
            <div key={i} className="row">
              <select value={it.unit_id} onChange={(e) => { const items = [...edit.items]; items[i] = { ...it, unit_id: e.target.value }; setEdit({ ...edit, items }); }}>{catalog.units.map((u) => <option key={u.id} value={u.id}>{u.name} ({fmt(u.value)})</option>)}</select>
              <input type="number" min={1} value={it.weight} onChange={(e) => { const items = [...edit.items]; items[i] = { ...it, weight: e.target.value }; setEdit({ ...edit, items }); }} />
              <span className="muted w80">{totalW ? ((Number(it.weight) / totalW) * 100).toFixed(2) : 0}%</span>
              <button className="icon-btn" onClick={() => setEdit({ ...edit, items: edit.items.filter((_: any, j: number) => j !== i) })}>✕</button>
            </div>
          ))}</div>
          <div className="row"><Btn kind="ghost" onClick={() => setEdit({ ...edit, items: [...edit.items, { unit_id: catalog.units.find((u) => !edit.items.some((x: any) => x.unit_id === u.id))?.id ?? catalog.units[0].id, weight: 100 }] })}>+ Юнит</Btn>
            <span className="muted">Расчётное матожидание: {fmt(edit.items.reduce((a: number, i: any) => a + (Number(i.weight) / (totalW || 1)) * (unitMap.get(i.unit_id)?.value ?? 0), 0))}</span></div>
          <Btn kind="gold" className="wide" busy={busy} onClick={() => save(edit)}>Сохранить</Btn>
        </Modal>
      )}
    </div>
  );
}

function Announce() {
  const { toast } = useStore(); const { busy, run } = useAsync();
  const [text, setText] = useState(''); const [list, setList] = useState<any[]>([]);
  const load = () => get('/api/announcements').then((r) => setList(r.items));
  useEffect(() => { load(); }, []);
  return (
    <div>
      <div className="form"><label>Текст объявления для всех игроков<textarea rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} /></label>
        <Btn busy={busy} disabled={!text.trim()} onClick={() => run(async () => { await post('/api/admin/announce', { text }); toast('Отправлено всем', 'ok'); setText(''); load(); })}>Отправить</Btn></div>
      <h3>Активные</h3>
      {list.length === 0 ? <Empty>Нет объявлений</Empty> : <div className="list">{list.map((a) => <div key={a.id} className="list-row"><span>{timeAgo(a.ts)}</span><span>{a.text}</span><Btn kind="ghost" onClick={() => run(async () => { await post('/api/admin/announce/delete', { id: a.id }); load(); })}>Убрать</Btn></div>)}</div>}
    </div>
  );
}

function Log() {
  const [nick, setNick] = useState(''); const [d, setD] = useState<any>(null);
  const load = () => get('/api/admin/log?nick=' + encodeURIComponent(nick)).then(setD);
  useEffect(() => { load(); }, []); // eslint-disable-line
  return (
    <div>
      <div className="toolbar"><input placeholder="Ник (пусто — все)" value={nick} onChange={(e) => setNick(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} /><Btn onClick={load}>Показать</Btn></div>
      <h3>Операции с гемами</h3>
      <div className="list">{d?.ledger.map((l: any) => <div key={l.id} className={`list-row ${l.delta > 0 ? 'ok' : 'bad'}`}><span>{timeAgo(l.ts)}</span><span>{l.nick} · {l.reason}{l.note ? ` · ${l.note}` : ''}</span><b>{l.delta > 0 ? '+' : ''}{fmtFull(l.delta)}</b><span className="muted">{fmt(l.balance_after)}</span></div>)}</div>
      <h3>Действия администраторов</h3>
      <div className="list">{d?.admin.map((a: any) => <div key={a.id} className="list-row"><span>{timeAgo(a.ts)}</span><span>{a.nick} · <b>{a.action}</b></span><small className="muted trunc">{a.detail}</small></div>)}</div>
    </div>
  );
}

function Images() {
  const { catalog, toast } = useStore(); const { busy, run } = useAsync();
  const [uid, setUid] = useState<string>(''); const [stamp, setStamp] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const upload = (unitId: string, f: File) => run(async () => {
    if (f.size > 1_000_000) throw new Error('Файл больше 1 МБ');
    const data: string = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = no; r.readAsDataURL(f); });
    await post('/api/admin/unit-image', { unit_id: unitId, data }); toast('Картинка загружена', 'ok'); setStamp(Date.now());
  });
  return (
    <div>
      <p className="muted">По умолчанию используются оригинальные иллюстрации, сгенерированные игрой. Вы можете заменить их своими PNG/JPEG/WebP (до 1 МБ, лучше квадрат 400×400). Загружайте только то, на что у вас есть права.</p>
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f && uid) upload(uid, f); e.target.value = ''; }} />
      <div className="grid units mini">{catalog.units.map((u) => (
        <div key={u.id} className="ucard small"><img className="unit-img" src={`/unit-img/${u.id}.svg?t=${stamp}`} alt="" /><div className="uname">{u.name}</div>
          <div className="row"><Btn kind="ghost" disabled={busy} onClick={() => { setUid(u.id); file.current?.click(); }}>Загрузить</Btn><Btn kind="ghost" disabled={busy} onClick={() => run(async () => { await post('/api/admin/unit-image/reset', { unit_id: u.id }); setStamp(Date.now()); })}>Сброс</Btn></div></div>
      ))}</div>
    </div>
  );
}

function Withdrawals() {
  const { toast, unitMap } = useStore(); const { busy, run } = useAsync();
  const [d, setD] = useState<any>(null);
  const load = () => get('/api/admin/withdrawals').then(setD);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);
  const resolve = (id: number, action: 'done' | 'reject') => run(async () => { await post('/api/admin/withdrawals/resolve', { id, action }); toast(action === 'done' ? 'Отмечено как выдано' : 'Отклонено, предмет возвращён', 'ok'); load(); });
  if (!d) return <div className="spinner" />;
  const pending = d.items.filter((w: any) => w.status === 'pending').length;
  return (
    <div>
      <p className="muted">Ожидают выдачи: <b>{pending}</b>. Окно выдачи — {d.slot.from}–{d.slot.to} (МСК); дата проставляется автоматически.</p>
      {d.items.length === 0 ? <Empty>Заявок на вывод нет</Empty> : (
        <div className="list">{d.items.map((w: any) => (
          <div key={w.id} className={`card wd-card ${w.status}`}>
            <div className="row between wrap">
              <div><b>#{w.id} · аккаунт {w.nick}</b><div>Выдать на ник: <b className="grad">{w.gameNick}</b></div></div>
              <b>{WD_STATUS[w.status]}</b>
            </div>
            <div className="row">{w.kind === 'unit' ? <><UnitImg id={w.unitId} className="wd-thumb" /><b>{unitMap.get(w.unitId)?.name} ×{w.qty}</b></> : <>Гемы: <Gem n={w.gems} full /></>}</div>
            <div className="muted">🕒 Выдача: {slotText(w.slotDate, w.from, w.to)} · заявка {timeAgo(w.createdAt)}</div>
            {w.status === 'pending' && <div className="row"><Btn kind="gold" busy={busy} onClick={() => resolve(w.id, 'done')}>Выдано</Btn><Btn kind="danger" busy={busy} onClick={() => resolve(w.id, 'reject')}>Отклонить (вернуть)</Btn></div>}
          </div>
        ))}</div>
      )}
    </div>
  );
}
