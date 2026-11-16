import { useEffect, useState } from 'react';
import { useStore } from './store';
import { Avatar, Gem, Modal, useCountUp, Btn } from './ui/bits';
import { isMuted, setMuted, sfx } from './sound';
import { Home } from './pages/Home';
import { Cases } from './pages/Cases';
import { Inventory } from './pages/Inventory';
import { Upgrader } from './pages/Upgrader';
import { Dice } from './pages/Dice';
import { Battles } from './pages/Battles';
import { Shop } from './pages/Shop';
import { Profile } from './pages/Profile';
import { Leaderboard } from './pages/Leaderboard';
import { Admin } from './pages/Admin';

const NAV = [
  ['home', '🏠', 'Главная'], ['cases', '📦', 'Кейсы'], ['inventory', '🎒', 'Инвентарь'], ['upgrader', '⚡', 'Апгрейдер'],
  ['dice', '🎲', 'Color Dice'], ['battles', '⚔️', 'Батлы'], ['shop', '🛒', 'Магазин'], ['profile', '👤', 'Профиль'], ['leaderboard', '🏆', 'Лидерборд'],
] as const;

export function Shell({ loginBonus }: { loginBonus: number }) {
  const { user, page, go, announcements, logout, catalog } = useStore();
  const [muted, setM] = useState(isMuted());
  const [bonus, setBonus] = useState(loginBonus);
  const [hiddenAnn, setHiddenAnn] = useState<number[]>([]);
  const gems = useCountUp(user.gems);
  const [root, sub] = page.split('/');
  useEffect(() => { if (bonus) sfx.coin(); }, [bonus]);

  const nav = user.isAdmin ? [...NAV, ['admin', '🛠️', 'Админ'] as const] : NAV;
  const ann = announcements.filter((a) => !hiddenAnn.includes(a.id))[0];

  let view;
  switch (root) {
    case 'cases': view = <Cases sub={sub} />; break;
    case 'inventory': view = <Inventory />; break;
    case 'upgrader': view = <Upgrader />; break;
    case 'dice': view = <Dice />; break;
    case 'battles': view = <Battles sub={sub} />; break;
    case 'shop': view = <Shop />; break;
    case 'profile': view = <Profile />; break;
    case 'leaderboard': view = <Leaderboard />; break;
    case 'admin': view = user.isAdmin ? <Admin /> : <Home />; break;
    default: view = <Home />;
  }

  return (
    <div className="app">
      <header className="top">
        <div className="logo" onClick={() => go('home')}><span>TOILET</span> GRADER</div>
        <div className="top-right">
          <div className="balance" onClick={() => go('profile')} title="История гемов в профиле"><i className="gem-ico" />{gems.toLocaleString('ru-RU')}</div>
          <button className="icon-btn" onClick={() => { setMuted(!muted); setM(!muted); }} aria-label="Звук">{muted ? '🔇' : '🔊'}</button>
          <div className="me" onClick={() => go('profile')}><Avatar unit={user.avatarUnit} nick={user.nick} size={34} /><span className="me-nick">{user.nick}</span></div>
          <button className="icon-btn" onClick={logout} title="Выйти" aria-label="Выйти">⏻</button>
        </div>
      </header>
      {ann && <div className="announce">📢 {ann.text}<button onClick={() => setHiddenAnn([...hiddenAnn, ann.id])}>✕</button></div>}
      <nav className="nav">
        {nav.map(([id, ico, label]) => (
          <button key={id} className={root === id || (id === 'home' && !root) ? 'on' : ''} onClick={() => go(id)}><span className="n-ico">{ico}</span><span className="n-label">{label}</span></button>
        ))}
      </nav>
      <main className="main" key={root}>{view}</main>
      {bonus > 0 && (
        <Modal onClose={() => setBonus(0)}>
          <div className="center bonus-pop">
            <div className="bonus-ico">🎁</div>
            <h2>Бонус за вход!</h2>
            <p className="muted">Добро пожаловать, {user.nick}! Заходи каждый день — награды растут.</p>
            <div className="big-gem"><Gem n={catalog.config.loginBonus} /></div>
            <Btn kind="gold" onClick={() => setBonus(0)}>Забрать</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
