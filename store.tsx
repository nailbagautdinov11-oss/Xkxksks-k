import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { get, post } from './api';
import type { Catalog, Daily, InvItem, Unit, User } from './types';
import { sfx } from './sound';

type WsMsg = { t: string; [k: string]: any };
interface Toast { id: number; text: string; kind: 'ok' | 'err' | 'info' }

interface Store {
  user: User; setUser: (u: User) => void;
  catalog: Catalog; unitMap: Map<string, Unit>; rarityColor: (r: string) => string;
  daily: Daily | null; inventory: InvItem[];
  refresh: () => Promise<void>; refreshInventory: () => Promise<void>;
  toast: (text: string, kind?: Toast['kind']) => void;
  logout: () => Promise<void>;
  page: string; go: (p: string) => void;
  onWs: (fn: (m: WsMsg) => void) => () => void;
  announcements: { id: number; text: string }[];
  setGems: (n: number) => void;
}
const Ctx = createContext<Store>(null as any);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ initialUser, catalog, onLogout, children }: { initialUser: User; catalog: Catalog; onLogout: () => void; children: ReactNode }) {
  const [user, setUser] = useState(initialUser);
  const [daily, setDaily] = useState<Daily | null>(null);
  const [inventory, setInventory] = useState<InvItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [announcements, setAnnouncements] = useState<{ id: number; text: string }[]>([]);
  const [page, setPage] = useState(() => location.hash.slice(1) || 'home');
  const listeners = useRef(new Set<(m: WsMsg) => void>());

  const unitMap = useMemo(() => new Map(catalog.units.map((u) => [u.id, u])), [catalog]);
  const rc = useMemo(() => new Map(catalog.rarities.map((r) => [r.id, r.color])), [catalog]);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    if (kind === 'err') sfx.error();
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const refresh = useCallback(async () => {
    const r = await get<{ user: User; daily: Daily }>('/api/me');
    setUser(r.user); setDaily(r.daily);
  }, []);
  const refreshInventory = useCallback(async () => {
    const r = await get<{ items: InvItem[] }>('/api/inventory');
    setInventory(r.items);
  }, []);

  useEffect(() => {
    refresh(); refreshInventory();
    get('/api/announcements').then((r) => setAnnouncements(r.items)).catch(() => {});
  }, [refresh, refreshInventory]);

  // WebSocket с автопереподключением
  useEffect(() => {
    let ws: WebSocket | null = null; let closed = false; let retry = 0;
    const connect = () => {
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      ws.onopen = () => { retry = 0; };
      ws.onmessage = (e) => {
        let m: WsMsg; try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'announce') { toast('📢 ' + m.text, 'info'); get('/api/announcements').then((r) => setAnnouncements(r.items)).catch(() => {}); }
        listeners.current.forEach((fn) => fn(m));
      };
      ws.onclose = (e) => {
        if (closed) return;
        if (e.code === 4001) { onLogout(); return; }
        setTimeout(connect, Math.min(10000, 1000 * ++retry));
      };
    };
    connect();
    return () => { closed = true; ws?.close(); };
  }, [toast, onLogout]);

  useEffect(() => {
    const h = () => setPage(location.hash.slice(1) || 'home');
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  const value: Store = {
    user, setUser, catalog, unitMap, rarityColor: (r) => rc.get(r) || '#fff', daily, inventory,
    refresh, refreshInventory, toast, page,
    go: (p) => { sfx.click(); location.hash = p; window.scrollTo({ top: 0 }); },
    logout: async () => { await post('/api/auth/logout'); onLogout(); },
    onWs: (fn) => { listeners.current.add(fn); return () => { listeners.current.delete(fn); }; },
    announcements, setGems: (n) => setUser((u) => ({ ...u, gems: n })),
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts">{toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div>
    </Ctx.Provider>
  );
}
