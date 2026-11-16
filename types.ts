export interface User { id: number; nick: string; gems: number; isAdmin: boolean; avatarUnit: string | null; wins: number; losses: number; streak: number; createdAt: number }
export interface Unit { id: string; name: string; rarity: string; value: number; desc: string }
export interface Rarity { id: string; color: string; label: string; order: number }
export interface CaseItem { unit_id: string; weight: number; chance: number }
export interface CaseT { id: string; name: string; price: number; color: string; tagline: string; enabled: boolean; ev: number; items: CaseItem[] }
export interface Catalog {
  units: Unit[]; rarities: Rarity[]; cases: CaseT[];
  config: { sellRate: number; shopMarkup: number; maxOpen: number; upgradeRtp: number; upgradeMaxChance: number; upgradeMinChance: number; loginBonus: number; dailyRewards: number[] };
}
export interface Daily { claimedToday: boolean; streak: number; nextIndex: number; rewards: number[] }
export interface InvItem { unit_id: string; qty: number }
export interface BattlePlayer { slot: number; userId: number | null; nick: string; isBot: boolean; team: number; avatarUnit: string | null; total: number; outcome: string | null }
export interface Battle {
  id: number; mode: string; maxPlayers: number; rounds: number; entry: number; status: string; caseId: string; caseName: string; caseColor: string;
  creatorId: number; createdAt: number; startedAt: number | null; finishedAt: number | null; revealed: number;
  players: BattlePlayer[]; rolls: { slot: number; unit_id: string; value: number }[][];
  result: { draw: boolean; winnerTeams: number[]; totals: Record<string, number>; gets: Record<string, { unit_id: string; value: number }[]> } | null;
}
