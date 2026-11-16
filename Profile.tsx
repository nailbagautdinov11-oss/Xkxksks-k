import { useEffect, useState } from 'react';
import { get, post, fmt, fmtFull, timeAgo } from '../api';
import { useStore } from '../store';
import { Avatar, Empty, Gem, Modal, UnitCard, useAsync } from '../ui/bits';
import { History } from './Battles';
import type { Battle, User } from '../types';

const REASONS: Record<string, string> = {
  start: 'Стартовый бонус', login_bonus: 'Бонус за вход', daily: 'Ежедневная награда', case_open: 'Открытие кейсов', sell: 'Продажа юнитов', shop_buy: 'Покупка в магазине',
  dice_bet: 'Color Dice: ставка', dice_win: 'Color Dice: выигрыш', battle_entry: 'Взнос в батл', battle_refund: 'Возврат взноса', battle_win: 'Награда за победу', admin_grant: 'Выдача администратором', admin_take: 'Списание администратором', withdraw: 'Заявка на вывод', withdraw_refund: 'Возврат по выводу',
};

export function Profile() {
  const { inventory, refresh, toast, unitMap, user } = useStore();
  const { run } = useAsync();
  const [p, setP] = useState<any>(null); const [ledger, setLedger] = useState<any[]>([]); const [pick, setPick] = useState(false);
  const load = () => { get('/api/profile').then(setP); get('/api/ledger?limit=60').then((r) => setLedger(r.items)); };
  useEffect(load, [user.gems]);
  if (!p) return <div className="page"><div className="spinner" /></div>;
  const u: User = p.user;
  const setAv = (id: string) => run(async () => { await post('/api/profile/avatar', { unit_id: id }); await refresh(); setPick(false); toast('Аватар обновлён', 'ok'); });
  return (
    <div className="page">
      <div className="card profile-head">
        <div className="av-edit" onClick={() => setPick(true)} title="Сменить аватар"><Avatar unit={u.avatarUnit} nick={u.nick} size={96} /><span>✎</span></div>
        <div><h1>{u.nick}</h1><div className="muted">В игре с {new Date(u.createdAt).toLocaleDateString('ru-RU')}{u.isAdmin ? ' · Администратор' : ''}</div></div>
      </div>
      <div className="grid stats">
        <div className="card stat"><small>Гемы</small><Gem n={u.gems} full /></div>
        <div className="card stat"><small>Юнитов</small><b>{p.unitCount}</b><small>{p.uniqueUnits} уникальных</small></div>
        <div className="card stat"><small>Победы / поражения</small><b>{u.wins} / {u.losses}</b></div>
        <div className="card stat"><small>Коллекция</small><Gem n={p.collectionValue} /></div>
        <div className="card stat"><small>Кейсов открыто</small><b>{fmtFull(p.casesOpened)}</b></div>
        <div className="card stat"><small>Апгрейды</small><b>{p.upgrades.success} / {p.upgrades.total}</b><small>успешных</small></div>
      </div>
      <h3>Лучший юнит</h3>
      {p.bestUnit ? <div className="grid units one"><UnitCard id={p.bestUnit.id} /></div> : <Empty>Пока нет юнитов</Empty>}
      <h3>История батлов</h3>
      {p.battleHistory.length ? <History list={p.battleHistory as Battle[]} /> : <Empty>Батлов ещё не было</Empty>}
      <h3>История гемов</h3>
      {ledger.length === 0 ? <Empty>Операций нет</Empty> : (
        <div className="list">{ledger.map((l) => (
          <div key={l.id} className={`list-row ${l.delta > 0 ? 'ok' : 'bad'}`}>
            <span>{timeAgo(l.ts)}</span><span>{REASONS[l.reason] ?? l.reason}{l.note ? <small className="muted"> · {l.note}</small> : null}</span>
            <b>{l.delta > 0 ? '+' : ''}{fmt(l.delta)}</b><span className="muted">{fmt(l.balance_after)}</span>
          </div>
        ))}</div>
      )}
      {pick && (
        <Modal onClose={() => setPick(false)} wide>
          <h2>Выберите аватар</h2>
          {inventory.length === 0 ? <Empty>Откройте кейс, чтобы получить юнитов</Empty> : <div className="grid units mini">{inventory.map((i) => <UnitCard key={i.unit_id} id={i.unit_id} small onClick={() => setAv(i.unit_id)} />)}</div>}
        </Modal>
      )}
      <span hidden>{unitMap.size}</span>
    </div>
  );
}
