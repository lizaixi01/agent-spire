import { CARD_BY_ID, statsFor, type Card } from "./cards";
import type { Run } from "./engine";
export interface Synergy {
  label: string;
  explanation: string;
  damage: number;
  block: number;
  draw: number;
  energy: number;
}
export function synergyFor(run: Run, card: Card): Synergy {
  const result: Synergy = {
    label: "",
    explanation: "",
    damage: 0,
    block: 0,
    draw: 0,
    energy: 0,
  };
  const b = run.battle;
  if (!b) return result;
  const last = b.sequence?.at(-1);
  const d = statsFor(card);
  if (d.special === "react" && b.observed)
    return {
      ...result,
      label: "观察 → 行动",
      explanation: "先读取环境反馈，再更新行动。伤害 +6。",
      damage: 6,
    };
  if (d.damage && (last === "harness" || last === "constraint"))
    return {
      ...result,
      label: "约束 → 执行",
      explanation: "先建立边界，再执行工具。格挡 +4。",
      block: 4,
    };
  if (d.damage && (last === "rag" || last === "hybrid"))
    return {
      ...result,
      label: "检索 → 行动",
      explanation: "先取得相关证据，再采取行动。伤害 +3。",
      damage: 3,
    };
  if (card.defId === "compress" && last === "memory")
    return {
      ...result,
      label: "记忆 → 整理",
      explanation: "检索记忆后整理关键上下文。额外抽 1 张牌。",
      draw: 1,
    };
  if (
    (card.defId === "evaluate" || card.defId === "review") &&
    last &&
    CARD_BY_ID[last]?.type === "attack"
  )
    return {
      ...result,
      label: "行动 → 验证",
      explanation: "行动之后检查实际结果，完成反馈闭环。能量 +1。",
      energy: 1,
    };
  return result;
}
