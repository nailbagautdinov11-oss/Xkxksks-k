// Безопасная первоначальная настройка администратора (выполняется на сервере, из консоли).
// Права администратора выдаются только здесь — прямой записью в БД. Через сайт получить их нельзя.
import readline from 'node:readline';
import { get, run } from '../server/db.ts';
import { ADMIN_NICK, hashPassword, validatePassword } from '../server/auth.ts';
import { addGems } from '../server/core.ts';
import { START_GEMS } from '../server/catalog.ts';
import { seedCatalog } from '../server/core.ts';

seedCatalog();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string) => new Promise<string>((r) => rl.question(q, r));

const envPw = process.env.ADMIN_PASSWORD;
console.log(`Настройка администратора: ник «${ADMIN_NICK}»`);
const pw = envPw ?? (await ask('Придумайте пароль администратора (мин. 8 символов): '));
validatePassword(pw);
const hash = hashPassword(pw);
const ex = get('SELECT id FROM users WHERE nick_lower=?', ADMIN_NICK.toLowerCase());
if (ex) {
  run('UPDATE users SET pass_hash=?, is_admin=1, banned=0 WHERE id=?', hash, ex.id);
  console.log('Аккаунт обновлён: пароль изменён, права администратора выданы.');
} else {
  const r = run('INSERT INTO users(nick,nick_lower,pass_hash,gems,is_admin,created_at) VALUES(?,?,?,0,1,?)',
    ADMIN_NICK, ADMIN_NICK.toLowerCase(), hash, Date.now());
  addGems(Number(r.lastInsertRowid), START_GEMS, 'start', 'Стартовый бонус');
  console.log('Аккаунт администратора создан.');
}
rl.close();
