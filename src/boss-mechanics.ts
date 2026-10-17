import { CARD_BY_ID, type CardDef } from "./cards";
import type { Enemy, Run } from "./engine";

export type BossState =
  | { kind: "feedback"; ready: boolean }
  | { kind: "window"; used: number }
  | { kind: "retrieval"; known: string[]; recalled: boolean }
  | { kind: "protocol"; step: number }
  | { kind: "recovery"; lastCard: string | null }
  | { kind: "boundary" }
  | { kind: "evaluation"; streak: number; attacked: boolean; defended: boolean }
  | { kind: "reward"; claimed: boolean; debt: number }
  | { kind: "evolution"; resisted: string | null; candidate: string | null; peak: number }
  | { kind: "council"; role: "coordinator" | "actor" | "auditor" };

export const BOSS_RULES = {
  feedback: { lesson: "react", name: "观察闭环", text: "每轮先打出技能或能力牌，解除首领本轮的攻击牌减伤。未准备时，攻击牌伤害减半。" },
  window: { lesson: "compression", name: "窗口预算", text: "每轮前 4 张牌正常结算；之后每张牌使首领获得 5 格挡，并使本次攻击意图增加 2。下轮预算重置。" },
  retrieval: { lesson: "rag", name: "检索锚点", text: "首领记住本战打过的牌。每轮首次重打同名牌，移除首领全部格挡、施加 1 易伤并抽 1 张；每轮首领行动后重建 8 格挡。" },
  protocol: { lesson: "mcp", name: "接口契约", text: "本轮先打技能，再接攻击，契约即通过，首领重击改为获得 6 格挡。顺序不符会重置进度；通过后本轮保持有效。" },
  recovery: { lesson: "recovery", name: "禁止原样重试", text: "连续打出同名牌时，该牌伤害减半，存活的首领反击 4 点（可格挡）。换一张牌即可解除；记录跨回合保留。" },
  boundary: { lesson: "isolation", name: "沙箱与执行", text: "奇数轮首领只防御，你的剩余格挡最多保留 16 至下轮；偶数轮释放重击。利用准备窗口限制执行阶段损失。" },
  evaluation: { lesson: "pass", name: "连续验收", text: "连续两轮都打出攻击牌与提供格挡的牌，才解除保命封印。漏一轮则进度归零；封印期间任何伤害都不能把首领生命降到 1 以下。" },
  reward: { lesson: "reward", name: "奖励诱饵", text: "每轮可主动领取一次 2 能量；代价是首领回复 20 生命，并使之后所有攻击永久增加 3。能量变多不代表交付更接近完成。" },
  evolution: { lesson: "retention", name: "定向适应", text: "首领记录本轮单张牌造成的最大实际伤害，下轮对该牌每段伤害减少 6。每轮重新记录；更换攻击可避开抗性。" },
  council: { lesson: "collaboration", name: "分工协作", text: "审核者存活时，指挥者受到的攻击牌伤害减半；审核者行动为所有存活同伴加格挡，执行者持续攻击。优先切断支援，再集中火力。三者均需击败。" },
} as const;

export const BOSS_KINDS = Object.keys(BOSS_RULES) as BossState["kind"][];

export function createBossState(chapter: number): BossState | undefined {
  if (chapter === 1) return { kind: "feedback", ready: false };
  if (chapter === 2) return { kind: "window", used: 0 };
  if (chapter === 3) return { kind: "retrieval", known: [], recalled: false };
  if (chapter === 4) return { kind: "protocol", step: 0 };
  if (chapter === 5) return { kind: "recovery", lastCard: null };
  if (chapter === 6) return { kind: "boundary" };
  if (chapter === 7) return { kind: "evaluation", streak: 0, attacked: false, defended: false };
  if (chapter === 8) return { kind: "reward", claimed: false, debt: 0 };
  if (chapter === 9) return { kind: "evolution", resisted: null, candidate: null, peak: 0 };
  if (chapter === 10) return { kind: "council", role: "coordinator" };
}

export function beforeBossCard(run: Run, card: CardDef): number {
  let extraDraw = 0;
  for (const enemy of run.battle!.enemies.filter(e => e.hp > 0)) {
    const state = enemy.boss;
    if (state?.kind === "feedback" && card.type !== "attack") state.ready = true;
    if (state?.kind === "window" && ++state.used > 4) enemy.block += 5;
    if (state?.kind === "retrieval") {
      if (!state.recalled && state.known.includes(card.id)) {
        enemy.block = 0;
        enemy.vulnerable++;
        state.recalled = true;
        extraDraw++;
      }
      if (!state.known.includes(card.id)) state.known.push(card.id);
    }
    if (state?.kind === "protocol" && state.step < 2) {
      state.step = state.step === 0 ? (card.type === "skill" ? 1 : 0) : card.type === "attack" ? 2 : card.type === "skill" ? 1 : 0;
    }
    if (state?.kind === "evaluation") {
      if (card.type === "attack") state.attacked = true;
      if (card.block) state.defended = true;
    }
  }
  return extraDraw;
}

export function bossCardDamage(run: Run, enemy: Enemy, card: CardDef, amount: number): number {
  const state = enemy.boss;
  if (state?.kind === "feedback" && !state.ready) return Math.floor(amount / 2);
  if (state?.kind === "recovery" && state.lastCard === card.id) return Math.floor(amount / 2);
  if (state?.kind === "evolution" && state.resisted === card.id) return Math.max(0, amount - 6);
  if (state?.kind === "council" && state.role === "coordinator" && run.battle!.enemies.some(e => e.hp > 0 && e.boss?.kind === "council" && e.boss.role === "auditor")) return Math.floor(amount / 2);
  return amount;
}

export function afterBossCard(run: Run, card: CardDef, hpBefore: Map<string, number>): number {
  let counter = 0;
  for (const enemy of run.battle!.enemies.filter(e => e.hp > 0)) {
    const state = enemy.boss;
    if (state?.kind === "recovery") {
      if (state.lastCard === card.id) counter += 4;
      state.lastCard = card.id;
    }
    if (state?.kind === "evolution") {
      const damage = (hpBefore.get(enemy.id) ?? enemy.hp) - enemy.hp;
      if (damage > state.peak) { state.peak = damage; state.candidate = card.id; }
    }
  }
  return counter;
}

export const bossHpFloor = (enemy: Enemy): number => enemy.boss?.kind === "evaluation" && enemy.boss.streak < 2 ? 1 : 0;

export function bossIntent(enemy: Enemy, turn: number): { kind: "attack" | "heavy" | "defend"; value: number } | null {
  const state = enemy.boss;
  const attack = (kind: "attack" | "heavy", base: number) => ({ kind, value: Math.floor(base * (enemy.weak > 0 ? 0.75 : 1)) });
  if (state?.kind === "protocol") return state.step === 2 ? { kind: "defend", value: 6 } : attack("heavy", Math.floor(enemy.damage * 1.6));
  if (state?.kind === "boundary") return turn % 2 ? { kind: "defend", value: 12 } : attack("heavy", Math.floor(enemy.damage * 1.8));
  if (state?.kind === "council" && state.role === "auditor") return { kind: "defend", value: 8 };
  return null;
}

export function bossTurnEnd(enemy: Enemy): void {
  const state = enemy.boss;
  if (state?.kind === "feedback") state.ready = false;
  if (state?.kind === "window") state.used = 0;
  if (state?.kind === "retrieval") { state.recalled = false; enemy.block += 8; }
  if (state?.kind === "protocol") state.step = 0;
  if (state?.kind === "evaluation") {
    if (state.streak < 2) state.streak = state.attacked && state.defended ? state.streak + 1 : 0;
    state.attacked = false; state.defended = false;
  }
  if (state?.kind === "reward") state.claimed = false;
  if (state?.kind === "evolution") { state.resisted = state.candidate; state.candidate = null; state.peak = 0; }
}

export function bossStatus(enemy: Enemy, turn: number): string {
  const s = enemy.boss;
  if (!s) return "";
  switch (s.kind) {
    case "feedback": return s.ready ? "已观察 · 本轮减伤解除" : "未观察 · 攻击牌伤害减半";
    case "window": return `本轮预算 ${s.used}/4 · 超限 ${Math.max(0, s.used - 4)} 张`;
    case "retrieval": return `锚点 ${s.known.length} 张 · ${s.recalled ? "本轮已召回" : "本轮可召回一次"}`;
    case "protocol": return `契约 ${s.step}/2 · ${["等待技能", "等待攻击", "验证通过"][s.step]}`;
    case "recovery": return `上次动作：${s.lastCard ? CARD_BY_ID[s.lastCard].name : "无"}`;
    case "boundary": return turn % 2 ? "沙箱准备 · 剩余格挡保留至多 16" : "执行阶段 · 重击即将到来";
    case "evaluation": return s.streak === 2 ? "连续验收完成 · 封印解除" : `连续验收 ${s.streak}/2 · 本轮攻击 ${s.attacked ? "✓" : "—"} / 防御 ${s.defended ? "✓" : "—"}`;
    case "reward": return `诱饵 ${s.claimed ? "本轮已领取" : "本轮可领取"} · 攻击永久 +${s.debt * 3}`;
    case "evolution": return `本轮抗性：${s.resisted ? CARD_BY_ID[s.resisted].name : "无"} · 待适应：${s.candidate ? CARD_BY_ID[s.candidate].name : "无"}`;
    case "council": return { coordinator: "指挥者 · 审核者存活时减伤", actor: "执行者 · 持续施压", auditor: "审核者 · 为全队提供格挡" }[s.role];
  }
}
