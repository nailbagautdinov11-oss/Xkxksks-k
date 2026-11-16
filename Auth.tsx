import { useState } from 'react';
import { post } from '../api';
import type { User } from '../types';
import { sfx } from '../sound';

export function Auth({ onAuth }: { onAuth: (u: User, bonus: number) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [nick, setNick] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (mode === 'register' && pw !== pw2) { setErr('Пароли не совпадают'); sfx.error(); return; }
    setBusy(true);
    try {
      const r = await post<{ user: User; loginBonus: number }>(`/api/auth/${mode}`, { nick, password: pw });
      sfx.win(2); onAuth(r.user, r.loginBonus);
    } catch (e: any) { setErr(e.message); sfx.error(); } finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-bg">{Array.from({ length: 14 }).map((_, i) => <img key={i} className="float-unit" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${-i * 1.7}s`, animationDuration: `${14 + (i % 5) * 3}s` }} src={`/unit-img/${['plunger-pup', 'royal-flushmaster', 'neon-nozzle', 'void-vortex', 'whirl-wizard', 'solar-seat', 'chrome-commode'][i % 7]}.svg`} alt="" />)}</div>
      <form className="auth-card" onSubmit={submit}>
        <div className="logo big"><span>TOILET</span> GRADER</div>
        <p className="muted center">Открывай кейсы, улучшай юнитов, побеждай в батлах</p>
        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setErr(''); }}>Вход</button>
          <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => { setMode('register'); setErr(''); }}>Регистрация</button>
        </div>
        <label>Игровой ник<input value={nick} onChange={(e) => setNick(e.target.value)} autoComplete="username" maxLength={20} placeholder="Например, Flush_King" required /></label>
        <label>Пароль<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Минимум 8 символов" required /></label>
        {mode === 'register' && <label>Повторите пароль<input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required /></label>}
        {err && <div className="form-err">{err}</div>}
        <button className={`btn primary wide ${busy ? 'busy' : ''}`} disabled={busy}>{mode === 'login' ? 'Войти' : 'Создать аккаунт и получить 1000 гемов'}</button>
      </form>
    </div>
  );
}
