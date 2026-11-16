import { useEffect, useState } from 'react';
import { get, post, fmt, timeAgo } from '../api';
import { useStore } from '../store';
import { Btn, Gem, Modal, UnitImg, useAsync } from '../ui/bits';
import { sfx } from '../sound';

export const WD_STATUS: Record<string, string> = { pending: '⏳ Ожидает', done: '✅ Выдано', rejected: '↩️ Отклонено' };
export const slotText = (date: string, from: string, to: string) => {
  const [y, m, d] = date.split('-'); return `${d}.${m}.${y}, ${from}–${to} (МСК)`;
};

export function WithdrawModal({ onClose, unitId }: { onClose: () => void; unitId?: string }) {
  const { inventory, unitMap, user, toast, refresh, refreshInventory } = useStore();
  const { busy, run } = useAsync();
  const [kind, setKind] = useState<'unit' | 'gems'>('unit');
  const [uid, setUid] = useState(unitId ?? inventory[0]?.unit_id ?? '');
  const [qty, setQty] = useState(1); const [gems, setGems] = useState(100); const [nick, setNick] = useState('');
  const [slot, setSlot] = useState<any>(null); const [mine, setMine] = useState<any[]>([]);
  const load = () => get('/api/withdraw').then((r) => { setSlot(r.slot); setMine(r.items); });
  useEffect(() => { load(); }, []);
  const max = inventory.find((i) => i.unit_id === uid)?.qty ?? 0;

  const submit = () => run(async () => {
    await post('/api/withdraw', { kind, unit_id: uid, qty, gems, nick });
    sfx.coin(); toast('Заявка создана! Ожидайте выдачи в указанное время', 'ok'); await Promise.all([refresh(), refreshInventory(), load()]);
  });

  return (
    <Modal onClose={onClose}>
      <h2>Вывод</h2>
      {slot && <div className="wd-slot">🕒 Выдача: <b>{slotText(slot.date, slot.from, slot.to)}</b></div>}
      <div className="tabs"><button className={kind === 'unit' ? 'on' : ''} onClick={() => setKind('unit')}>Юнит</button><button className={kind === 'gems' ? 'on' : ''} onClick={() => setKind('gems')}>Гемы</button></div>
      <div className="form">
        {kind === 'unit' ? (
          inventory.length === 0 ? <p className="muted">В инвентаре нет юнитов.</p> : <>
            <label>Юнит<select value={uid} onChange={(e) => { setUid(e.target.value); setQty(1); }}>{inventory.map((i) => <option key={i.unit_id} value={i.unit_id}>{unitMap.get(i.unit_id)!.name} (×{i.qty})</option>)}</select></label>
            {uid && <div className="center"><UnitImg id={uid} className="wd-img" /></div>}
            <label>Количество (макс. {max})<input type="number" min={1} max={max} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(max, Number(e.target.value) || 1)))} /></label>
          </>
        ) : (
          <label>Сколько гемов (у вас {fmt(user.gems)})<input type="number" min={1} max={user.gems} value={gems} onChange={(e) => setGems(Number(e.target.value))} /></label>
        )}
        <label>Ваш ник для выдачи<input value={nick} maxLength={20} onChange={(e) => setNick(e.target.value)} placeholder="Например, Flush_King" /></label>
        <Btn kind="gold" busy={busy} disabled={!nick.trim() || (kind === 'unit' ? !uid || max < 1 : gems < 1 || gems > user.gems)} onClick={submit}>Отправить заявку</Btn>
        <div className="muted small-t">Предмет списывается сразу. Если заявку отклонят — он вернётся на ваш аккаунт.</div>
      </div>
      {mine.length > 0 && <>
        <h4>Мои заявки</h4>
        <div className="list">{mine.slice(0, 6).map((w) => (
          <div key={w.id} className="list-row wd-row"><span>{timeAgo(w.createdAt)}</span>
            <span>{w.kind === 'unit' ? `${unitMap.get(w.unitId)?.name} ×${w.qty}` : <Gem n={w.gems} />} → {w.gameNick}</span><b>{WD_STATUS[w.status]}</b></div>
        ))}</div>
      </>}
    </Modal>
  );
}
