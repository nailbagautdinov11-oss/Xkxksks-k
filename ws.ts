import type http from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { userByToken } from './auth.ts';

const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
const byUser = new Map<number, Set<WebSocket>>();

export function parseCookies(h: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (h || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function attachWs(server: http.Server) {
  server.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/ws')) { socket.destroy(); return; }
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) { socket.destroy(); return; }
    const user = userByToken(parseCookies(req.headers.cookie).tg_session);
    if (!user) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => {
      let set = byUser.get(user.id);
      if (!set) byUser.set(user.id, (set = new Set()));
      set.add(ws);
      (ws as any).alive = true;
      ws.on('pong', () => ((ws as any).alive = true));
      ws.on('close', () => { set!.delete(ws); if (!set!.size) byUser.delete(user.id); });
      ws.on('error', () => ws.terminate());
      ws.on('message', () => { /* клиент ничего не управляет через WS: все действия идут через API */ });
      ws.send(JSON.stringify({ t: 'hello' }));
    });
  });
  setInterval(() => {
    for (const set of byUser.values()) for (const ws of set) {
      if (!(ws as any).alive) { ws.terminate(); continue; }
      (ws as any).alive = false; ws.ping();
    }
  }, 30000).unref();
}

export function broadcast(msg: object) {
  const s = JSON.stringify(msg);
  for (const set of byUser.values()) for (const ws of set) if (ws.readyState === 1) ws.send(s);
}
export function toUser(userId: number, msg: object) {
  const s = JSON.stringify(msg);
  for (const ws of byUser.get(userId) ?? []) if (ws.readyState === 1) ws.send(s);
}
export function kick(userId: number) {
  for (const ws of byUser.get(userId) ?? []) ws.close(4001, 'banned');
}
