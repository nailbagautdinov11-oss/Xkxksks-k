import { post } from '../api';
import { useStore } from '../store';
import { Btn, Gem, UnitImg, useAsync } from '../ui/bits';
import { sfx } from '../sound';

export function Home() {
  const { user, daily, catalog, go, refresh, toast } = useStore();
  const { busy, run } = useAsync();
  const claim = () => run(async () => {
    const r = await post<{ reward: number; streak: number }>('/api/daily/claim');
    sfx.coin(); toast(`+${r.reward} гемов! Серия: ${r.streak} дн.`, 'ok'); await refresh();
  });
  const sections = [
    ['cases', '📦', 'Кейсы', '6 категорий — от Basic до Secret'], ['upgrader', '⚡', 'Апгрейдер', 'Рискни юнитом ради большего'],
    ['dice', '🎲', 'Color Dice', 'Три кубика, шесть цветов'], ['battles', '⚔️', 'Батлы', 'Дуэли и командные бои'],
  ];
  const featured = ['royal-flushmaster', 'void-vortex', 'prism-porcelain'];
  return (
    <div className="page">
      <section className="hero">
        <div className="hero-text">
          <h1>Привет, <span className="grad">{user.nick}</span>!</h1>
          <p className="muted">Собери коллекцию лучших юнитов Toilet Tower. Каждый шанс проверяется сервером.</p>
          <div className="row"><Btn onClick={() => go('cases')}>Открыть кейсы</Btn><Btn kind="ghost" onClick={() => go('battles')}>В батл</Btn></div>
        </div>
        <div className="hero-units">{featured.map((id, i) => <UnitImg key={id} id={id} className={`hu hu${i}`} />)}</div>
      </section>

      <section className="card">
        <div className="card-head"><h3>Ежедневная награда</h3><span className="muted">Серия: {daily?.streak ?? 0} дн.</span></div>
        <div className="daily">
          {catalog.config.dailyRewards.map((r, i) => {
            const done = daily ? (daily.claimedToday ? i < daily.nextIndex || (daily.nextIndex === 0 && daily.streak > 0) : i < daily.nextIndex) : false;
            const cur = daily && !daily.claimedToday && i === daily.nextIndex;
            return <div key={i} className={`day ${done ? 'done' : ''} ${cur ? 'cur' : ''}`}><small>День {i + 1}</small><Gem n={r} /><span className="tick">{done ? '✓' : ''}</span></div>;
          })}
        </div>
        <Btn kind="gold" onClick={claim} busy={busy} disabled={!daily || daily.claimedToday}>{daily?.claimedToday ? 'Уже получено сегодня' : 'Забрать награду'}</Btn>
      </section>

      <section className="grid sections">
        {sections.map(([id, ico, t, d]) => (
          <div key={id} className="card link-card" onClick={() => go(id)}><div className="sec-ico">{ico}</div><h3>{t}</h3><p className="muted">{d}</p></div>
        ))}
      </section>

      <section className="card stats-row">
        <div><b>{user.wins}</b><small>побед</small></div><div><b>{user.losses}</b><small>поражений</small></div>
        <div><b>{catalog.units.length}</b><small>юнитов в игре</small></div><div><b>{catalog.cases.length}</b><small>кейсов</small></div>
      </section>
    </div>
  );
}
