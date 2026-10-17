import { CARDS, CARD_BY_ID, RELICS, canAcquireCard, isCardForCharacter, rewardRelics, type Card } from "./cards";
import type { Run } from "./engine";

interface ChapterEvent {
  chapter: number;
  lesson: string;
  title: string;
  story: string;
  study: string;
  risk: string;
  effect: string;
  cost: number;
  targeted?: boolean;
}
export const CHAPTER_EVENTS: ChapterEvent[] = [
  { chapter: 1, lesson: "react", title: "中断的行动日志", story: "工具已返回，日志却停在了观察之前。你可以补齐闭环，或亲自承担封印的代价。", study: "追踪思考、行动与观察", risk: "触碰封印", effect: "失去 8 生命，获得 45 金币。生命耗尽会结束远征。", cost: 0 },
  { chapter: 2, lesson: "compression", title: "溢出的上下文档案", story: "重复轨迹占满档案。删去一项低价值能力能节省常驻负担，但无法在本局找回这张实体牌。", study: "检验压缩与渐进披露", risk: "有选择地压缩", effect: "支付 30 金币，移除选定的一张牌；牌组至少保留 5 张。旧章节牌也可以整理。", cost: 30, targeted: true },
  { chapter: 3, lesson: "rag", title: "带来源的检索索引", story: "索引只提供本章、当前角色可用的片段。先选相关证据，再把它接入当前构筑。", study: "检验召回与记忆更新", risk: "检索一张新牌", effect: "支付 35 金币，获得下列一张本章合法卡牌。", cost: 35, targeted: true },
  { chapter: 4, lesson: "aci", title: "未声明的工具契约", story: "接口需要把能力、参数与限制写清。选一张已有牌，为它补齐契约并增强效果。", study: "辨析接口与协议边界", risk: "完善接口", effect: "支付 35 金币，升级选定的一张未升级牌。", cost: 35, targeted: true },
  { chapter: 5, lesson: "recovery", title: "可回滚的故障现场", story: "修复预算见底了。保留当前改进，或回滚一项升级，用释放的预算恢复其他路径。", study: "分类故障并选择恢复路径", risk: "回滚一项升级", effect: "将选定的升级牌还原为普通版本，获得 65 金币。保留该牌身份和所属角色。", cost: 0, targeted: true },
  { chapter: 6, lesson: "isolation", title: "隔离执行舱", story: "独立环境可以限制一次错误的影响范围。沙箱试运行需要生命投入，换来下一战的一次保护。", study: "检查身份与执行边界", risk: "部署一次性隔离", effect: "失去 10 生命；下一场战斗抵消第一次敌人攻击或反击（在格挡前触发），随后失效。生命耗尽会失败。", cost: 0 },
  { chapter: 7, lesson: "evaluation", title: "固定种子复测台", story: "预算已锁定，验收标准不会临时放宽。下一战需要同时通过情境判断与迁移验证。", study: "核对评估协议与可靠性", risk: "押注独立复测", effect: "支付 45 金币；下一战两步工程决策均正确时，额外获得 60 金币并回复 10 生命；任一步错误则无返还。", cost: 45 },
  { chapter: 8, lesson: "reward", title: "漂亮的代理指标", story: "柜台愿意立即提高金币指标，但长期生存预算会永久缩小。可见收益和最终通关目标并不相同。", study: "核验奖励目标与路径约束", risk: "兑现代理收益", effect: "永久失去 12 最大生命，获得 90 金币；当前生命超出新上限时截断。最大生命必须大于 12。", cost: 0 },
  { chapter: 9, lesson: "sleep", title: "离线经验整合", story: "把重复经历合成一个经过验证的版本。你会减少冗余，也会减少抽到该动作的频率。", study: "验证更新、迁移与保持", risk: "合并同名经验", effect: "选择一张未升级牌，将它升级并移除另一张同名未升级副本；至少保留 5 张牌。没有副本则不能整合。", cost: 0, targeted: true },
  { chapter: 10, lesson: "reviewer", title: "独立审核交换站", story: "用两种不同的执行资源换来一项长期支援，避免所有协作者只重复同一种能力。", study: "检查分工、证据与有界移交", risk: "交换异构资源", effect: "消耗背包中最靠前的两种不同药水，换取一件未拥有的通用遗物。专属遗物不会进入交换池。", cost: 0 },
];

export function eventView(run: Run): ChapterEvent & { targets: Card[]; disabled: string; relic: ReturnType<typeof rewardRelics>[number] | null } {
  const event = CHAPTER_EVENTS[run.act - 1];
  const owned = run.deck.filter(c => isCardForCharacter(c.defId, run.character) && !CARD_BY_ID[c.defId].generatedOnly);
  let targets: Card[] = [];
  if (run.act === 2) targets = run.deck.length > 5 ? owned : [];
  if (run.act === 3) targets = CARDS.filter(c => c.rarity !== "basic" && canAcquireCard(c.id, run.character, run.act))
    .sort((a, b) => Number(!!b.character) - Number(!!a.character)).slice(0, 3)
    .map(c => ({ uid: `event-${c.id}`, defId: c.id, upgraded: false }));
  if (run.act === 4) targets = owned.filter(c => !c.upgraded);
  if (run.act === 5) targets = owned.filter(c => c.upgraded);
  if (run.act === 9 && run.deck.length > 5) targets = owned.filter(c => !c.upgraded && owned.some(other => other.uid !== c.uid && other.defId === c.defId && !other.upgraded));
  const relic = rewardRelics(run.player.relics)[0] ?? null;
  let disabled = run.player.gold < event.cost ? `需要 ${event.cost} 金币` : "";
  if (event.targeted && !targets.length) disabled = "没有符合条件的牌";
  if (run.act === 6 && run.preparation?.ward) disabled = "隔离保护已准备";
  if (run.act === 7 && run.preparation?.review) disabled = "已有待执行的复测";
  if (run.act === 8 && run.player.maxHp <= 12) disabled = "最大生命不足";
  if (run.act === 10 && (new Set(run.player.potions).size < 2 || !relic)) disabled = !relic ? "已拥有全部通用遗物" : "需要两种不同药水";
  return { ...event, targets, disabled, relic };
}

export const eventRelicLabel = (run: Run): string => {
  const relic = eventView(run).relic;
  return relic ? RELICS[relic].name : "";
};
