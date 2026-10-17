import type { AudioCue } from "./audio";
import type { Card } from "./cards";
import type { Run, EnemyAction } from "./engine";
import { synergyFor } from "./synergy";
export interface Impact {
  cue: AudioCue | null;
  shake: number;
  kills: string[];
  label: string;
  damage: number;
  broken: string[];
  playerDamage: number;
  absorbed: number;
  incoming: EnemyAction[];
}
export function impactFor(before: Run, after: Run, card?: Card): Impact {
  const empty: Impact = {
    cue: null,
    shake: 0,
    kills: [],
    label: "",
    damage: 0,
    broken: [],
    playerDamage: 0, absorbed: 0, incoming: [],
  };
  if (before === after || !before.battle || !after.battle) return empty;
  const kills = after.battle.enemies
    .filter(
      (e) =>
        e.hp === 0 &&
        before.battle!.enemies.some((old) => old.id === e.id && old.hp > 0),
    )
    .map((e) => e.id);
  const damage = before.battle.enemies.reduce(
    (sum, e) =>
      sum +
      Math.max(
        0,
        e.hp - (after.battle!.enemies.find((n) => n.id === e.id)?.hp ?? e.hp),
      ),
    0,
  );
  const broken = after.battle.enemies
    .filter(
      (e) =>
        e.block === 0 &&
        before.battle!.enemies.some(
          (old) => old.id === e.id && old.block > 0,
        ) &&
        !!card,
    )
    .map((e) => e.id);
  const label = card ? synergyFor(before, card).label : "";
  const hurt = Math.max(0, before.player.hp - after.player.hp);
  const incoming = after.battle.enemyActions ?? [];
  const absorbed = incoming.reduce((sum, e) => sum + e.blocked, 0);
  const victory = before.screen === "combat" && after.screen === "reward";
  return {
    cue: victory
      ? "victory"
      : hurt ? "hurt" : kills.length
        ? "kill"
        : label
          ? "combo"
          : damage >= 12
            ? "critical"
            : damage > 0
              ? "impact"
              : absorbed ? "guard" : incoming.some(e => e.kind === "weaken") ? "debuff" : broken.length
                  ? "break"
                  : null,
    shake: victory
      ? 24
      : hurt ? (hurt >= 12 ? 22 : 16) : kills.length
        ? 20
        : label && damage
          ? 18
          : damage >= 12 ? 16 : damage > 0 ? 6 : absorbed ? 4 : 0,
    kills,
    label,
    damage,
    broken,
    playerDamage: hurt, absorbed, incoming,
  };
}
