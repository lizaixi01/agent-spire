import { CHAPTERS, LESSONS, LESSON_BY_ID } from "./content";
export type CharacterId = "scholar" | "engineer" | "weaver";
export type CardType = "attack" | "skill" | "power";
export interface CardDef {
  id: string;
  name: string;
  english: string;
  type: CardType;
  cost: number;
  lesson: string;
  rarity: "basic" | "common" | "uncommon" | "rare";
  icon: string;
  damage?: number;
  block?: number;
  draw?: number;
  energy?: number;
  weak?: number;
  vulnerable?: number;
  poison?: number;
  strength?: number;
  heal?: number;
  character?: CharacterId;
  hits?: number;
  retain?: boolean;
  purge?: boolean;
  generatedOnly?: boolean;
  exhaust?: boolean;
  special?: "react" | "cache" | "cleanse" | "retention" | "echo" | "reset";
}
export interface Card {
  uid: string;
  defId: string;
  upgraded: boolean;
}
export interface Character {
  id: CharacterId;
  name: string;
  english: string;
  hp: number;
  energy: number;
  draw: number;
  strength: number;
  subtitle: string;
  description: string;
  relic: RelicId;
  signature: string;
  starterDeck: string[];
  color: string;
}
export const CHARACTERS: Character[] = [
  {
    id: "scholar",
    name: "观测者",
    english: "THE OBSERVER",
    hp: 200,
    energy: 2,
    draw: 3,
    strength: 0,
    subtitle: "看见，才能理解。",
    description: "坚韧壁垒：200 生命；每回合 2 能量、抽 3 张。专属卡治疗、格挡与反击；遗物“重置”每幕一次回满生命，未用额度过幕存成 Banked Reset 重置卡。",
    relic: "reset",
    signature: "mend",
    starterDeck: ["strike", "strike", "strike", "defend", "defend", "defend", "observe", "mend", "bulwark", "guard-strike"],
    color: "#91d4ac",
  },
  {
    id: "engineer",
    name: "铸序师",
    english: "THE ARCHITECT",
    hp: 72,
    energy: 3,
    draw: 5,
    strength: 8,
    subtitle: "让每一次行动，都有边界。",
    description: "烈焰重击：72 生命；每回合 3 能量、抽 5 张，开战 8 力量。专属卡蓄力与高费爆发；秩序砧石使每回合第一张至少 2 费的攻击额外造成 8 点伤害。",
    relic: "anvil",
    signature: "heavy-strike",
    starterDeck: ["strike", "strike", "strike", "strike", "defend", "defend", "defend", "observe", "heavy-strike", "overdrive"],
    color: "#ec9e69",
  },
  {
    id: "weaver",
    name: "织忆者",
    english: "THE ARCHIVIST",
    hp: 68,
    energy: 6,
    draw: 8,
    strength: 0,
    subtitle: "让经验，在时间里生长。",
    description: "疾速连奏：68 生命；每回合 6 能量、抽 8 张，首回合多抽 1 张。零费快攻、三段连击与抽牌衔接；记忆丝线每打出 3 张牌额外抽 1 张。",
    relic: "thread",
    signature: "flurry",
    starterDeck: ["quick-strike", "quick-strike", "quick-strike", "defend", "defend", "quick-step", "quick-step", "observe", "flurry", "hybrid"],
    color: "#73a7e4",
  },
];
interface RelicDef {
  name: string;
  icon: string;
  description: string;
  character?: CharacterId;
}
export const RELICS = {
  lantern: {
    character: "scholar",
    name: "求知之灯",
    icon: "lantern",
    description: "观测者旧版专属。每场战斗胜利后回复 6 点生命。",
  },
  anvil: {
    character: "engineer",
    name: "秩序砧石",
    icon: "shield",
    description: "铸序师专属。每回合第一张至少 2 费的攻击额外造成 8 点伤害。",
  },
  thread: {
    character: "weaver",
    name: "记忆丝线",
    icon: "layers",
    description: "织忆者专属。首回合多抽 1 张；每回合每打出 3 张牌，额外抽 1 张。",
  },
  reset: {
    character: "scholar",
    name: "重置",
    icon: "cycle",
    description: "观测者专属。每幕可主动使用一次：回复全部生命。未用额度过幕存为一张 Banked Reset 重置卡（最多持有一张），新幕恢复一次额度。",
  },
  prism: { name: "观测棱镜", icon: "eye", description: "每回合抽牌数增加 1。" },
  battery: {
    name: "永续火种",
    icon: "flame",
    description: "每回合最大能量增加 1。",
  },
  seal: {
    name: "审查者之印",
    icon: "seal",
    description: "每回合开始时获得 3 点格挡。",
  },
  heart: {
    name: "不灭之核",
    icon: "heart",
    description: "最大生命增加 12，并回复 12 点生命。",
  },
} as const satisfies Record<string, RelicDef>;
export type RelicId = keyof typeof RELICS;
export function isRelicForCharacter(id: RelicId, character: CharacterId): boolean {
  if (!Object.hasOwn(RELICS, id)) return false;
  const relic: RelicDef = RELICS[id];
  return !relic.character || relic.character === character;
}
export function rewardRelics(owned: readonly RelicId[]): RelicId[] {
  return (Object.keys(RELICS) as RelicId[]).filter(id => {
    const relic: RelicDef = RELICS[id];
    return !relic.character && !owned.includes(id);
  });
}
const c = (
  id: string,
  name: string,
  english: string,
  type: CardType,
  cost: number,
  lesson: string,
  icon: string,
  effects: Partial<CardDef>,
  rarity: CardDef["rarity"] = "common",
): CardDef => ({
  id,
  name,
  english,
  type,
  cost,
  lesson,
  icon,
  rarity,
  ...effects,
});
const CARD_OWNERS: Record<string, CharacterId> = {
  hybrid: "weaver", mcp: "weaver", skill: "weaver", discovery: "weaver", rag: "weaver", event: "weaver", handoff: "weaver", compress: "weaver",
  pass: "engineer", aci: "engineer", evaluate: "engineer", sft: "engineer", evolve: "engineer", collab: "engineer", review: "engineer",
  harness: "scholar", firewall: "scholar", memory: "scholar", fidelity: "scholar", constraint: "scholar", recover: "scholar", sandbox: "scholar", ablate: "scholar", retention: "scholar", sleep: "scholar",
};
export const CARDS: CardDef[] = [
  c(
    "strike",
    "工具调用",
    "TOOL CALL",
    "attack",
    1,
    "agent",
    "sword",
    { damage: 6 },
    "basic",
  ),
  c(
    "defend",
    "上下文屏障",
    "CONTEXT GUARD",
    "skill",
    1,
    "context",
    "shield",
    { block: 5 },
    "basic",
  ),
  c(
    "observe",
    "环境观测",
    "OBSERVATION",
    "skill",
    0,
    "react",
    "eye",
    { draw: 1 },
    "basic",
  ),
  c(
    "react",
    "思考 · 行动",
    "REACT LOOP",
    "attack",
    1,
    "react",
    "cycle",
    { damage: 8, special: "react" },
    "uncommon",
  ),
  c(
    "harness",
    "秩序构架",
    "HARNESS",
    "skill",
    1,
    "harness",
    "tower",
    { block: 9, strength: 1 },
    "uncommon",
  ),
  c(
    "cache",
    "稳定前缀",
    "PREFIX CACHE",
    "power",
    1,
    "cache",
    "layers",
    { special: "cache" },
    "uncommon",
  ),
  c("firewall", "注入防线", "TRUST BOUNDARY", "skill", 1, "injection", "seal", {
    block: 8,
    special: "cleanse",
  }),
  c("skill", "按需唤醒", "DISCLOSURE", "skill", 0, "skills", "spark", {
    draw: 2,
    exhaust: true,
  }),
  c(
    "compress",
    "上下文压缩",
    "COMPACTION",
    "skill",
    0,
    "compression",
    "compress",
    { energy: 1, exhaust: true },
  ),
  c("memory", "记忆回响", "MEMORY", "skill", 1, "memory", "book", {
    block: 6,
    draw: 1,
  }),
  c("rag", "证据之刃", "RETRIEVE", "attack", 1, "rag", "search", {
    damage: 9,
    draw: 1,
  }),
  c(
    "hybrid",
    "双路检索",
    "HYBRID SEARCH",
    "attack",
    1,
    "hybrid",
    "branch",
    { damage: 5, special: "echo" },
    "uncommon",
  ),
  c("aci", "精确接口", "CLEAR INTERFACE", "attack", 1, "aci", "code", {
    damage: 10,
  }),
  c("fidelity", "保真传递", "FIDELITY", "skill", 1, "fidelity", "link", {
    block: 7,
    draw: 1,
  }),
  c("mcp", "协议连接", "MCP BRIDGE", "skill", 0, "mcp", "link", {
    draw: 1,
    block: 3,
  }),
  c("discovery", "能力发现", "DISCOVERY", "skill", 1, "discovery", "compass", {
    draw: 3,
  }),
  c(
    "constraint",
    "不可越界",
    "HARD CONSTRAINT",
    "skill",
    2,
    "constraints",
    "shield",
    { block: 18 },
    "uncommon",
  ),
  c("recover", "故障恢复", "RECOVERY", "skill", 1, "recovery", "cycle", {
    heal: 5,
    special: "cleanse",
    exhaust: true,
  }),
  c("sandbox", "隔离沙盒", "SANDBOX", "skill", 1, "isolation", "box", {
    block: 11,
  }),
  c("event", "事件唤醒", "EVENT LOOP", "attack", 0, "events", "bolt", {
    damage: 5,
    exhaust: true,
  }),
  c(
    "pass",
    "可靠一击",
    "RELIABILITY",
    "attack",
    2,
    "pass",
    "target",
    { damage: 19 },
    "uncommon",
  ),
  c("evaluate", "独立验证", "EVALUATE", "attack", 1, "evaluation", "target", {
    damage: 8,
    vulnerable: 2,
  }),
  c("ablate", "控制变量", "ABLATION", "skill", 1, "ablation", "flask", {
    block: 6,
    weak: 2,
  }),
  c(
    "sft",
    "示范学习",
    "SUPERVISED",
    "power",
    1,
    "sft",
    "star",
    { strength: 3 },
    "uncommon",
  ),
  c("support", "能力奠基", "FOUNDATION", "skill", 1, "support", "tower", {
    energy: 2,
    exhaust: true,
  }),
  c("reward", "路径惩罚", "VERIFIED PENALTY", "attack", 1, "reward", "seal", {
    damage: 7,
    weak: 2,
  }),
  c(
    "evolve",
    "持续进化",
    "EVOLUTION",
    "power",
    2,
    "evolution",
    "spark",
    { strength: 5 },
    "rare",
  ),
  c(
    "retention",
    "保留与迁移",
    "RETENTION",
    "power",
    1,
    "retention",
    "layers",
    { special: "retention" },
    "uncommon",
  ),
  c(
    "sleep",
    "离线整合",
    "CONSOLIDATION",
    "skill",
    1,
    "sleep",
    "moon",
    { heal: 8, draw: 2, exhaust: true },
    "rare",
  ),
  c(
    "collab",
    "协同求真",
    "NEW EVIDENCE",
    "attack",
    2,
    "collaboration",
    "branch",
    { damage: 12, draw: 2 },
    "rare",
  ),
  c(
    "review",
    "审查者之眼",
    "REVIEWER",
    "attack",
    1,
    "reviewer",
    "eye",
    { damage: 8, poison: 4 },
    "uncommon",
  ),
  c(
    "handoff",
    "有界移交",
    "HANDOFF",
    "skill",
    0,
    "handoff",
    "link",
    { energy: 1, draw: 1, exhaust: true },
    "uncommon",
  ),
  c("quick-strike", "瞬时调用", "QUICK STRIKE", "attack", 0, "events", "bolt", { character: "weaver", damage: 4, exhaust: true }, "basic"),
  c("quick-step", "轻量调度", "QUICK STEP", "skill", 0, "discovery", "compass", { character: "weaver", block: 3, draw: 1, exhaust: true }),
  c("flurry", "并发连奏", "FLURRY", "attack", 1, "hybrid", "branch", { character: "weaver", damage: 3, hits: 3, draw: 1 }, "uncommon"),
  c("flow", "证据流转", "FLOW", "skill", 0, "memory", "book", { character: "weaver", draw: 3, exhaust: true }, "uncommon"),
  c("heavy-strike", "全力执行", "HEAVY STRIKE", "attack", 2, "aci", "sword", { character: "engineer", damage: 24 }, "uncommon"),
  c("overdrive", "执行蓄势", "OVERDRIVE", "skill", 1, "constraints", "flame", { character: "engineer", strength: 4, exhaust: true }),
  c("meteor", "终局交付", "FINAL DELIVERY", "attack", 3, "evaluation", "target", { character: "engineer", damage: 42, exhaust: true }, "rare"),
  c("mend", "状态修复", "MEND", "skill", 1, "recovery", "cycle", { character: "scholar", block: 8, heal: 8, exhaust: true }),
  c("bulwark", "持久防线", "BULWARK", "skill", 2, "isolation", "shield", { character: "scholar", block: 24 }, "uncommon"),
  c("guard-strike", "稳态反击", "GUARD STRIKE", "attack", 1, "harness", "shield", { character: "scholar", damage: 6, block: 8 }),
  c("banked-reset", "重置卡", "BANKED RESET", "skill", 1, "recovery", "cycle", { character: "scholar", special: "reset", retain: true, exhaust: true, purge: true, generatedOnly: true }, "rare"),
];
for (const card of CARDS) card.character ??= CARD_OWNERS[card.id];
// Every chapter offers three neutral foundations even when a role has no specific
// card for that topic. Learned role cards remain usable in later chapters.
const chapterTopics = ["入门", "上下文", "记忆", "工具", "编程", "交互", "评估", "训练", "进化", "协作"];
CHAPTERS.forEach((_, index) => {
  const lessons = LESSONS.filter(l => l.chapter === index + 1);
  CARDS.push(
    c(`chapter-${index + 1}-practice`, `${chapterTopics[index]}·实践`, "PRACTICE", "attack", 1, lessons[0].id, "sword", { damage: 7 }),
    c(`chapter-${index + 1}-guard`, `${chapterTopics[index]}·守护`, "GUARD", "skill", 1, lessons[1 % lessons.length].id, "shield", { block: 7 }),
    c(`chapter-${index + 1}-insight`, `${chapterTopics[index]}·梳理`, "INSIGHT", "skill", 0, lessons[2 % lessons.length].id, "book", { draw: 2, exhaust: true }),
  );
});
export const CARD_BY_ID = Object.fromEntries(
  CARDS.map((card) => [card.id, card]),
) as Record<string, CardDef>;
export function isCardForCharacter(defId: string, character: CharacterId): boolean {
  return Object.hasOwn(CARD_BY_ID, defId) &&
    (!CARD_BY_ID[defId].character || CARD_BY_ID[defId].character === character);
}
export function canAcquireCard(defId: string, character: CharacterId, chapter?: number): boolean {
  return isCardForCharacter(defId, character) && !CARD_BY_ID[defId].generatedOnly &&
    (chapter === undefined || LESSON_BY_ID[CARD_BY_ID[defId].lesson].chapter === chapter);
}
export const statsFor = (card: Card): CardDef => {
  const def = CARD_BY_ID[card.defId];
  if (!card.upgraded) return def;
  return {
    ...def,
    damage: def.damage ? def.damage + 3 : undefined,
    block: def.block ? def.block + 3 : undefined,
    heal: def.heal ? def.heal + 3 : undefined,
    draw: def.draw ? def.draw + 1 : undefined,
    strength: def.strength ? def.strength + 1 : undefined,
    cost: def.special === "cache" || def.special === "retention" ? 0 : def.cost,
  };
};
export function cardText(card: Card, strength = 0, weak = 0): string {
  const d = statsFor(card);
  const text: string[] = [];
  if (d.damage)
    text.push(
      `造成 ${Math.floor((d.damage + strength) * (weak > 0 ? 0.75 : 1))} 点伤害${d.hits ? `，攻击 ${d.hits} 次` : d.special === "echo" ? "，重复一次" : ""}`,
    );
  if (d.block) text.push(`获得 ${d.block} 点格挡`);
  if (d.draw) text.push(`抽 ${d.draw} 张牌`);
  if (d.energy) text.push(`获得 ${d.energy} 点能量`);
  if (d.strength) text.push(`获得 ${d.strength} 点力量`);
  if (d.weak) text.push(`施加 ${d.weak} 层虚弱`);
  if (d.vulnerable) text.push(`施加 ${d.vulnerable} 层易伤`);
  if (d.poison) text.push(`施加 ${d.poison} 层侵蚀`);
  if (d.heal) text.push(`回复 ${d.heal} 点生命`);
  if (d.special === "react")
    text.push("本回合打出过观测牌时，额外造成 6 点伤害");
  if (d.special === "cache") text.push("此后每回合获得 1 点额外能量");
  if (d.special === "retention") text.push("此后每回合保留至多 8 点格挡");
  if (d.special === "cleanse") text.push("清除自身虚弱和易伤");
  if (d.special === "reset") text.push("回复全部生命");
  if (d.retain) text.push("保留：回合结束不弃置");
  if (d.exhaust) text.push("消耗");
  if (d.purge) text.push("使用后永久移出牌组");
  return text.join("。") + "。";
}
