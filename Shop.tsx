import { useEffect, useState } from 'react';
import { get, post, fmt } from '../api';
import { useStore } from '../store';
import { Btn, Gem, UnitCard, useAsync } from '../ui/bits';
import { sfx } from '../sound';

export function Shop() {
  const { user, setGems, toast, refreshInventory, inventory, unitMap, catalog } = useStore();
  const { busy, run } = useAsync();
  const [offers, setOffers] = useState<{ unit_id: string; price: number }[]>([]);
  useEffect(() => { get('/api/shop').then((r) => setOffers(r.offers)); }, []);

  const buy = (o: { unit_id: string; price: number }) => run(async () => {
    const r = await post<{ balance: number }>('/api/shop/buy', { unit_id: o.unit_id });
    sfx.coin(); setGems(r.balance); toast(`Куплено: ${unitMap.get(o.unit_id)!.name}`, 'ok'); await refreshInventory();
  });
  const dupes = (maxOrder: number) => inventory.filter((i) => i.qty > 1 && catalog.rarities.find((r) => r.id === unitMap.get(i.unit_id)!.rarity)!.order <= maxOrder).map((i) => ({ unit_id: i.unit_id, qty: i.qty - 1 }));
  const sellDupes = (maxOrder: number) => run(async () => {
    const items = dupes(maxOrder); if (!items.length) { toast('Дубликатов нет'); return; }
    const r = await post<{ gained: number; balance: number }>('/api/inventory/sell', { items });
    sfx.coin(); setGems(r.balance); toast(`Продано дубликатов на ${fmt(r.gained)} гемов`, 'ok'); await refreshInventory();
  });
  const value = (items: { unit_id: string; qty: number }[]) => Math.floor(items.reduce((a, i) => a + unitMap.get(i.unit_id)!.value * i.qty, 0) * catalog.config.sellRate);

  return (
    <div className="page">
      <h1>Магазин</h1>
      <p className="muted">Предложения дня обновляются каждые сутки (UTC). Цена выше рыночной — это плата за гарантию.</p>
      <div className="grid units">{offers.map((o) => (
        <UnitCard key={o.unit_id} id={o.unit_id} price={o.price}>
          <Btn busy={busy} disabled={user.gems < o.price} onClick={() => buy(o)} className="buy">Купить</Btn>
        </UnitCard>
      ))}</div>
      <h3>Быстрая продажа дубликатов</h3>
      <p className="muted">Оставляем по одному юниту каждого вида, остальные продаём за {Math.round(catalog.config.sellRate * 100)}% стоимости.</p>
      <div className="row wrap">
        {[[1, 'Common + Uncommon'], [2, 'до Rare'], [3, 'до Epic'], [7, 'Все']].map(([n, l]) => {
          const d = dupes(n as number);
          return <Btn key={n as number} kind="ghost" busy={busy} disabled={!d.length} onClick={() => sellDupes(n as number)}>{l as string} · {fmt(value(d))}</Btn>;
        })}
      </div>
    </div>
  );
}
