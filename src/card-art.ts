import { CARD_BY_ID } from "./cards";
import { icon } from "./icons";
interface CardIllustration {
  atlas: "cognition" | "practice";
  scene: number;
  description: string;
}

// Row-major coordinates correspond to the documented illustration prompts.
export const CARD_ILLUSTRATIONS: Record<string, CardIllustration> = {
  strike: {
    atlas: "cognition",
    scene: 0,
    description: "工具调用：机械手启动工具插槽",
  },
  defend: {
    atlas: "cognition",
    scene: 1,
    description: "上下文窗口：有限窗口内的相关卷轴",
  },
  observe: {
    atlas: "cognition",
    scene: 2,
    description: "环境观测：放大镜读取环境反馈",
  },
  react: {
    atlas: "cognition",
    scene: 3,
    description: "ReAct：思考、行动与观察的循环",
  },
  harness: {
    atlas: "cognition",
    scene: 4,
    description: "Harness：支撑模型核心的工具与约束框架",
  },
  cache: {
    atlas: "cognition",
    scene: 5,
    description: "前缀缓存：重复前缀复用已存储的计算",
  },
  firewall: {
    atlas: "cognition",
    scene: 6,
    description: "信任边界：隔开可信指令与恶意输入",
  },
  skill: {
    atlas: "cognition",
    scene: 7,
    description: "技能：按需逐步展开的说明卷轴",
  },
  compress: {
    atlas: "cognition",
    scene: 8,
    description: "上下文压缩：冗长记录收束为关键摘要",
  },
  memory: {
    atlas: "cognition",
    scene: 9,
    description: "长期记忆：持久保存到档案中的记忆晶体",
  },
  rag: {
    atlas: "cognition",
    scene: 10,
    description: "证据检索：从资料库取回可追溯的证据",
  },
  hybrid: {
    atlas: "cognition",
    scene: 11,
    description: "混合检索：稀疏与稠密两路证据汇合",
  },
  aci: {
    atlas: "cognition",
    scene: 12,
    description: "工具接口：清晰区分的操作与参数插槽",
  },
  fidelity: {
    atlas: "cognition",
    scene: 13,
    description: "参数保真：工具参数与原始要求精确对齐",
  },
  mcp: {
    atlas: "cognition",
    scene: 14,
    description: "MCP：连接不同工具系统的标准协议桥梁",
  },
  discovery: {
    atlas: "cognition",
    scene: 15,
    description: "工具发现：按需照亮可用工具",
  },
  constraint: {
    atlas: "practice",
    scene: 16,
    description: "硬约束：由门锁执行的行动边界",
  },
  recover: {
    atlas: "practice",
    scene: 17,
    description: "错误恢复：修复故障后重新尝试",
  },
  sandbox: {
    atlas: "practice",
    scene: 18,
    description: "沙箱：把试验与外部环境隔离",
  },
  event: {
    atlas: "practice",
    scene: 19,
    description: "事件循环：事件驱动下一步行动",
  },
  pass: {
    atlas: "practice",
    scene: 20,
    description: "可靠性：多次执行逐一检验",
  },
  evaluate: {
    atlas: "practice",
    scene: 21,
    description: "评估：独立参照检验实际产物",
  },
  ablate: {
    atlas: "practice",
    scene: 22,
    description: "消融：只移除一个组件比较效果",
  },
  sft: {
    atlas: "practice",
    scene: 23,
    description: "监督微调：从示范轨迹中学习",
  },
  support: {
    atlas: "practice",
    scene: 24,
    description: "基础能力：支撑系统表现的模型地基",
  },
  reward: {
    atlas: "practice",
    scene: 25,
    description: "奖励设计：对齐目标并惩罚无效绕路",
  },
  evolve: {
    atlas: "practice",
    scene: 26,
    description: "持续进化：依据反馈改进能力",
  },
  retention: {
    atlas: "practice",
    scene: 27,
    description: "保留与迁移：保存旧知识并用于新任务",
  },
  sleep: {
    atlas: "practice",
    scene: 28,
    description: "离线巩固：整理经验并沉淀记忆",
  },
  collab: {
    atlas: "practice",
    scene: 29,
    description: "协作：不同参与者贡献互补证据",
  },
  review: {
    atlas: "practice",
    scene: 30,
    description: "独立审查：第二视角检查已有产物",
  },
  handoff: {
    atlas: "practice",
    scene: 31,
    description: "任务交接：携带明确边界与上下文的交付",
  },
};

// New role cards use the same native pixel symbols as the existing knowledge cards.
for (const card of Object.values(CARD_BY_ID)) {
  if (!CARD_ILLUSTRATIONS[card.id]) CARD_ILLUSTRATIONS[card.id] = {
    atlas: "practice", scene: Object.keys(CARD_ILLUSTRATIONS).length,
    description: `${card.name}：${card.english}`,
  };
}

export function cardIllustration(id: string): string {
  const art = CARD_ILLUSTRATIONS[id];
  if (!art) return "";
  const glyph =
    (
      {
        defend: "window",
        strike: "tool",
        memory: "archive",
        mcp: "protocol",
        fidelity: "check",
        constraint: "lock",
        recover: "cycle",
      } as Record<string, string>
    )[id] ?? CARD_BY_ID[id].icon;
  return `<span class="concept-art minimal" data-concept="${id}" role="img" aria-label="${art.description.split("：")[0]}：像素图示">${icon(glyph, "concept-glyph", 48)}</span>`;
}
