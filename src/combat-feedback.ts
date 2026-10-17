import { statsFor, type Card } from "./cards";
import type { Run } from "./engine";

export interface CombatFeedback {
  target: string;
  kind:
    | "damage"
    | "block"
    | "heal"
    | "absorb"
    | "draw"
    | "energy"
    | "power"
    | "status";
  text: string;
}
export function combatFeedback(
  before: Run,
  after: Run,
  card?: Card,
): CombatFeedback[] {
  if (before === after || !before.battle || !after.battle) return [];
  const feedback: CombatFeedback[] = [];
  const add = (target: string, kind: CombatFeedback["kind"], text: string) =>
    feedback.push({ target, kind, text });
  for (const enemy of before.battle.enemies) {
    const next = after.battle.enemies.find((e) => e.id === enemy.id);
    if (!next) continue;
    if (next.hp < enemy.hp) add(enemy.id, "damage", `−${enemy.hp - next.hp}`);
    if (card && next.block < enemy.block)
      add(enemy.id, "absorb", `抵挡 ${enemy.block - next.block}`);
    if (next.block > enemy.block)
      add(enemy.id, "block", `+${next.block - enemy.block} 格挡`);
    for (const [key, label] of [
      ["weak", "虚弱"],
      ["vulnerable", "易伤"],
      ["poison", "侵蚀"],
    ] as const)
      if (next[key] > enemy[key])
        add(enemy.id, "status", `${label} +${next[key] - enemy[key]}`);
  }
  const p = before.player;
  const n = after.player;
  if (n.hp < p.hp) add("player", "damage", `−${p.hp - n.hp}`);
  if (n.hp > p.hp) add("player", "heal", `+${n.hp - p.hp} 生命`);
  const absorbed = (after.battle.enemyActions ?? []).reduce((sum, action) => sum + action.blocked, 0);
  if (absorbed) add("player", "absorb", `格挡 ${absorbed}`);
  if (n.block > p.block) add("player", "block", `+${n.block - p.block} 格挡`);
  if (n.weak > p.weak) add("player", "status", `虚弱 +${n.weak - p.weak}`);
  if (card) {
    const d = statsFor(card);
    const draw = after.battle.hand.filter(
      (c) => !before.battle!.hand.some((old) => old.uid === c.uid),
    ).length;
    if (draw) add("player", "draw", `抽牌 +${draw}`);
    const energy = n.energy - p.energy + d.cost;
    if (energy > 0) add("player", "energy", `能量 +${energy}`);
    if (n.strength > p.strength)
      add("player", "power", `力量 +${n.strength - p.strength}`);
    if (after.battle.cache > before.battle.cache)
      add("player", "power", "缓存 +1");
    if (after.battle.retention && !before.battle.retention)
      add("player", "power", "保留 8");
  }
  return feedback;
}
