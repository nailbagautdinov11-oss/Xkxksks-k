import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useState } from 'react';
import { get } from './api';
import type { Catalog, User } from './types';
import { Auth } from './pages/Auth';
import { StoreProvider } from './store';
import { Shell } from './Shell';

function Root() {
  const [state, setState] = useState<'loading' | 'out' | 'in'>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [bonus, setBonus] = useState(0);

  const enter = useCallback(async (u: User, b = 0) => {
    try { setCatalog(await get<Catalog>('/api/catalog')); setUser(u); setBonus(b); setState('in'); } catch { setState('out'); }
  }, []);
  useEffect(() => {
    get<{ user: User }>('/api/me').then((r) => enter(r.user)).catch(() => setState('out'));
  }, [enter]);
  const out = useCallback(() => { setUser(null); setState('out'); location.hash = ''; }, []);

  if (state === 'loading') return <div className="splash"><div className="logo big"><span>TOILET</span> GRADER</div><div className="spinner" /></div>;
  if (state === 'out' || !user || !catalog) return <Auth onAuth={(u, b) => enter(u, b)} />;
  return <StoreProvider initialUser={user} catalog={catalog} onLogout={out}><Shell loginBonus={bonus} /></StoreProvider>;
}
createRoot(document.getElementById('root')!).render(<Root />);
