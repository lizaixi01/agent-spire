import type { AudioCue } from "./audio";
import { statsFor, type Card } from "./cards";
import type { Run, EnemyAction } from "./engine";
import { synergyFor } from "./synergy";
export interface ImpactBeat {
  at: number;
  target: string;
  attacker?: string;
  damage: number;
  blocked: number;
  hpBefore: number;
  hpAfter: number;
  maxHp: number;
  cue: AudioCue;
  shake: number;
  hold: number;
  breakGuard: boolean;
  finisher: boolean;
}
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
  beats: ImpactBeat[];
  settleMs: number;
  comboCount: number;
}
export function impactFor(before: Run, after: Run, card?: Card): Impact {
  const empty: Impact = {
    cue: null,
    shake: 0,
    kills: [],
    label: "",
    damage: 0,
    broken: [],
    playerDamage: 0, absorbed: 0, incoming: [], beats: [], settleMs: 0, comboCount: 0,
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
  const broken = after.battle.attackHits ? [...new Set(after.battle.attackHits.filter(h => h.blockBefore > 0 && h.blockAfter === 0).map(h => h.targetId))] : after.battle.enemies
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
  const incoming = after.battle.enemyActions ?? [];
  const hurt = incoming.reduce((sum, a) => sum + a.damage, 0) || Math.max(0, before.player.hp - after.player.hp);
  const absorbed = incoming.reduce((sum, e) => sum + e.blocked, 0);
  const victory = before.screen === "combat" && after.screen === "reward";
  const beats: ImpactBeat[] = [];
  const hits = after.battle.attackHits ?? [];
  const windup = card && statsFor(card).cost >= 2 ? 180 : 120;
  for (const [i, hit] of hits.entries()) {
    const enemy = after.battle.enemies.find(e => e.id === hit.targetId)!;
    const finisher = hit.hpBefore > 0 && hit.hpAfter === 0;
    const breakGuard = hit.blockBefore > 0 && hit.blockAfter === 0;
    const last = hits.length > 1 && i === hits.length - 1;
    const strong = hit.damage >= 12 || (last && hit.damage > 0);
    beats.push({ at: windup + i * 120, target: hit.targetId, ...hit, maxHp: enemy.maxHp,
      cue: finisher ? "kill" : breakGuard ? "break" : strong ? "critical" : hit.damage ? "impact" : "guard",
      shake: finisher ? 36 : breakGuard ? 28 : hit.damage >= 12 ? 32 : last && hit.damage ? 24 : hit.damage ? 18 : 10,
      hold: finisher ? 100 : strong || breakGuard ? 75 : 35, breakGuard, finisher });
  }
  // Passive damage (e.g. poison) has no card strike ledger.
  if (!hits.length) for (const enemy of before.battle.enemies) {
    const next = after.battle.enemies.find(e => e.id === enemy.id);
    if (!next || next.hp >= enemy.hp) continue;
    beats.push({ at: 120, target: enemy.id, damage: enemy.hp - next.hp, blocked: 0,
      hpBefore: enemy.hp, hpAfter: next.hp, maxHp: next.maxHp, cue: next.hp ? "impact" : "kill",
      shake: next.hp ? 18 : 36, hold: next.hp ? 35 : 100, breakGuard: false, finisher: !next.hp });
  }
  const incomingStart = beats.length ? beats[beats.length - 1].at + 260 : 220;
  // Card healing and counterattacks must remain separate visible events.
  let hp = after.player.hp + incoming.reduce((sum, a) => sum + a.damage, 0);
  for (const [i, action] of incoming.filter(a => a.kind === "attack" || a.kind === "heavy").entries()) {
    beats.push({ at: incomingStart + i * 260, target: "player", attacker: action.enemyId,
      damage: action.damage, blocked: action.blocked, hpBefore: hp, hpAfter: hp - action.damage,
      maxHp: after.player.maxHp, cue: action.damage ? "hurt" : "guard",
      shake: action.damage ? (action.damage >= 12 ? 34 : 26) : 12,
      hold: action.damage ? 90 : 45, breakGuard: false, finisher: false });
    hp -= action.damage;
  }
  return {
    cue: victory
      ? "victory"
      : hurt ? "hurt" : kills.length
        ? "kill"
        : broken.length ? "break" : label
          ? "combo"
          : damage >= 12
            ? "critical"
            : damage > 0
              ? "impact"
              : absorbed ? "guard" : incoming.some(e => e.kind === "weaken") ? "debuff" : null,
    shake: Math.max(0, ...beats.map(b => b.shake), label && damage ? 18 : 0),
    kills,
    label,
    damage,
    broken,
    playerDamage: hurt, absorbed, incoming,
    beats,
    settleMs: beats.length ? Math.max(...beats.map(b => b.at)) + (victory ? 780 : 420) : 0,
    comboCount: card ? after.battle.cardsPlayed ?? 1 : 0,
  };
}
