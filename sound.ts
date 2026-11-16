// Звуковые эффекты синтезируются WebAudio — внешние файлы не нужны.
let ctx: AudioContext | null = null;
let muted = localStorage.getItem('tg_muted') === '1';
export const isMuted = () => muted;
export function setMuted(m: boolean) { muted = m; localStorage.setItem('tg_muted', m ? '1' : '0'); }

function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.08, delay = 0, slide = 0) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
export const sfx = {
  click: () => tone(520, 0.06, 'triangle', 0.05),
  tick: () => tone(900 + Math.random() * 120, 0.03, 'square', 0.025),
  coin: () => { tone(988, 0.08, 'square', 0.05); tone(1319, 0.18, 'square', 0.05, 0.07); },
  roll: () => { for (let i = 0; i < 6; i++) tone(200 + Math.random() * 300, 0.05, 'sawtooth', 0.03, i * 0.07); },
  win: (tier = 0) => { const base = [523, 659, 784, 1047, 1319]; base.slice(0, 3 + Math.min(2, tier)).forEach((f, i) => tone(f, 0.22, 'triangle', 0.07, i * 0.09)); },
  big: () => { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.05, i * 0.08)); tone(130, 0.9, 'sine', 0.1, 0, -60); },
  lose: () => { tone(300, 0.25, 'sawtooth', 0.06, 0, -150); tone(200, 0.35, 'sawtooth', 0.06, 0.2, -100); },
  error: () => tone(160, 0.18, 'square', 0.06),
  whoosh: () => tone(1200, 0.5, 'sine', 0.04, 0, -1000),
};
export const rarityTier = (r: string) => ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Secret', 'Exclusive'].indexOf(r);
