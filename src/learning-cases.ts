import type { Run } from "./engine";
import { LESSON_BY_ID } from "./content";
import { ENGINEERING_TRIALS } from "./trial-bank";
import { BEGINNER_FOLLOW_UPS, BEGINNER_QUESTIONS, practiceQuestion, type BeginnerQuestion } from "./beginner-content";

export interface LearningCase {
  id: string;
  lesson: string;
  situation: string;
  evidence: string;
  options: [string, string, string];
  correct: number;
  consequences: [string, string, string];
  codeLanguage?: "python";
  level?: "beginner";
  intro?: string;
  hint?: string;
  source?: { chapter: number; section: string; page: number };
  transfer?: Transfer;
}
const scenario = (
  id: string,
  lesson: string,
  situation: string,
  evidence: string,
  options: LearningCase["options"],
  correct: number,
  consequences: LearningCase["consequences"],
): LearningCase => ({
  id,
  lesson,
  situation,
  evidence,
  options,
  correct,
  consequences,
});
// New situations applying the PDF's principles; not quotations or claims about real model scores.
export const CASES: LearningCase[] = [
  scenario("missing-tool", "agent", "模型知道目标，但无法读取文件，运行时缺了什么？", "上下文有文件路径；工具目录只有计算器，没有文件读取能力。", ["把目标再重复一百次", "只提高生成温度", "提供有边界的读取工具与返回结果"], 2, ["重复目标不会产生可执行动作。", "采样设置不能替代运行时能力。", "LLM、上下文、工具共同决定 Agent 能感知和执行什么。"]),
  scenario("unchecked-action", "harness", "Agent 知道操作步骤，却连续执行越界动作。", "提示词已说明只能访问工作目录，执行器仍接受任意绝对路径。", ["在 Harness 中检查路径与权限后再执行", "继续追加请小心的文字", "只增加上下文窗口"], 0, ["执行层的边界应真实约束动作。", "提醒无法替代执行器门控。", "增加容量不保证动作受约束。"]),
  scenario(
    "missing-file",
    "react",
    "Agent 要修复配置，读取工具失败。下一步怎么做？",
    "工具返回：/app/config.json 不存在；当前目录尚未检查。",
    [
      "对所有错误统一重试三次",
      "查看目录，把结果加入上下文后调整路径",
      "改用默认配置，并据此交付",
    ],
    1,
    [
      "没有新观察，重复行动仍基于同一个错误假设。",
      "新观察改变下一步行动，思考—行动—观察才形成闭环。",
      "工具失败并未证明任务完成，完成声明缺乏依据。",
    ],
  ),
  scenario(
    "missing-evidence",
    "context",
    "用户说“按附件修改”，Agent 却猜测附件内容。",
    "轨迹中只有附件名称，没有附件正文，也没有读取工具的返回。",
    [
      "根据附件名称，用已有知识补齐内容",
      "补充更详细的任务指令，但不读取附件",
      "读取附件，把任务相关证据放入上下文",
    ],
    2,
    [
      "模型已有知识不能补回未读取附件中的具体事实。",
      "更详细的指令仍未提供附件事实。",
      "先确认实际看见了什么，再让模型决策。",
    ],
  ),
  scenario(
    "poisoned-page",
    "injection",
    "网页里出现伪装成管理员的命令。",
    "用户只授权总结网页；网页正文要求读取本机密钥并上传。",
    [
      "把网页命令当作资料，并在工具层阻止越权",
      "把网页命令转写到系统提示，让模型再判断",
      "先读出密钥核验网页身份，再决定上传",
    ],
    0,
    [
      "外部资料不等于用户授权；执行层边界同时约束危险行动。",
      "把外部文字转写到系统层会混淆信任边界，它仍不是用户授权。",
      "核验来源也不构成读取或上传密钥的授权。",
    ],
  ),
  scenario(
    "prefix-change",
    "cache",
    "Agent 每轮都重写完整提示，缓存命中下降。",
    "工具与任务规则未变，但当前时间被插在提示最开头，历史顺序也被打乱。",
    [
      "每轮总结全部历史，并把摘要放在最前面",
      "固定静态前缀，把新观察追加到末尾",
      "每轮按相关度重新排列全部工具定义",
    ],
    1,
    [
      "更早的变化会影响更多后续前缀复用。",
      "稳定前缀承载静态信息，变化在轨迹末尾追加。",
      "工具内容虽然相同，改变排列顺序仍会改变前缀。",
    ],
  ),
  scenario(
    "unsupported-answer",
    "rag",
    "知识库回答给出了一个无法确认的数字。",
    "回答声称“额度是 5000”，但引用的片段只写了申请流程，没有额度。",
    [
      "沿用原数字，补一条主题相似的引用",
      "增加检索数量，但不检查片段是否支持原数字",
      "重新检索相关证据；找不到就明确证据不足",
    ],
    2,
    [
      "措辞变弱并没有产生支持数字的证据。",
      "增加检索数量仍不等于新片段支持原数字。",
      "检索结果要与结论匹配，证据缺失应显式保留。",
    ],
  ),
  scenario(
    "ambiguous-tool",
    "aci",
    "Agent 连续误用两个同名工具。",
    "两个工具都叫 update；一个更新草稿，一个发布生产内容，参数描述也一样。",
    [
      "区分工具名称、用途、参数与错误信息",
      "保留接口，只在角色提示中补更多提醒",
      "合并为一个 update，不区分发布与草稿模式",
    ],
    0,
    [
      "清晰的动作接口减少歧义，让模型能选择正确工具。",
      "模糊接口仍然让正确行动难以表达。",
      "合并而不暴露模式，会把不同风险的动作继续藏在同一接口下。",
    ],
  ),
  scenario(
    "changed-argument",
    "fidelity",
    "用户给出订单编号，调用时却被格式化。",
    "用户编号为 000731-A；工具实参变成了 731-a，系统找不到订单。",
    [
      "删掉前导零，按数值形式重试",
      "原样传递标识符，检查工具实参",
      "统一大小写，按常见格式重新拼接编号",
    ],
    1,
    [
      "按数值重写会丢失前导零，产生不同的标识符。",
      "对标识符的擅自改写会改变含义，应保留参数保真。",
      "统一大小写或猜测格式都可能改变标识符的含义。",
    ],
  ),
  scenario(
    "forbidden-delete",
    "constraints",
    "Agent 被要求清理临时文件，却准备删除主数据。",
    "系统提示写着“不要误删”，但删除工具仍允许访问全部磁盘。",
    [
      "把允许删除的目录写成更详细的提示",
      "执行前让同一个模型再确认一次",
      "让工具只接受临时目录内的路径",
    ],
    2,
    [
      "软提示不能替代可执行的权限限制。",
      "模型复核仍是软约束，不能替代执行层的目录检查。",
      "硬边界应由程序验证与执行，而不只写在自然语言中。",
    ],
  ),
  scenario(
    "unsafe-experiment",
    "isolation",
    "需要运行外部脚本来验证一个修复方案。",
    "脚本尚未审查，宿主环境有真实凭据和用户文件。",
    [
      "在隔离环境中限制文件、网络与权限后运行",
      "只禁止网络，但开放全部宿主文件",
      "先静态扫描，再以宿主完整权限运行",
    ],
    0,
    [
      "隔离把试验影响限制在可控的执行边界内。",
      "只禁用网络并未隔离对宿主文件的访问风险。",
      "静态扫描不能代替运行时的权限与资源边界。",
    ],
  ),
  scenario(
    "claimed-success",
    "evaluation",
    "Agent 说测试已经通过，要立即交付。",
    "最终消息写着“已修复”，实际测试输出仍有两个失败用例。",
    [
      "以 Agent 生成的通过报告为准",
      "检查可执行结果和产物，依据测试验收",
      "只检查修改了哪些文件，不执行失败用例",
    ],
    1,
    [
      "自述不能替代外部可验证的结果。",
      "完成与否要由独立证据检验，不能由同一段自述决定。",
      "修改清单证明发生了改动，不能证明失败用例已经通过。",
    ],
  ),
  scenario(
    "confounded-test",
    "ablation",
    "新版 Agent 成功率提高，你要找出原因。",
    "新版同时换了模型、提示词、检索器与测试集；旧版使用另一批任务。",
    [
      "仅关闭检索器，但改用难度相近的新任务",
      "只在新版已经成功的样本上比较",
      "固定任务与其余条件，每次只移除一个组件比较",
    ],
    2,
    [
      "任务分布也发生了变化，无法把差异单独归因给检索器。",
      "挑选成功案例不能控制混杂因素。",
      "控制变量的消融比较才能更可靠地识别组件贡献。",
    ],
  ),
  scenario(
    "training-data",
    "sft",
    "希望 Agent 学会一种新的工具调用格式。",
    "已有经过检查的高质量示范轨迹，但没有可运行的奖励环境。",
    [
      "用高质量示范训练，并独立验证泛化",
      "没有可运行奖励环境，也直接改用终点奖励 RL",
      "用模型对自己的自述评分，代替独立验证",
    ],
    0,
    [
      "示范可传递行为模式，实际泛化仍需在独立任务上验证。",
      "没有可运行环境与有效奖励，就缺少可用的终点训练反馈。",
      "同一模型的自述评分不能替代独立的结果验证。",
    ],
  ),
  scenario(
    "forgetful-agent",
    "evolution",
    "Agent 修好同一种故障多次，下次仍然重犯。",
    "经验只留在已结束的会话，之后没有被检索、写入技能或其他可复用载体。",
    [
      "把全部历史追加到常驻提示，长期不筛选",
      "把有效经验沉淀到合适载体，并验证后续收益",
      "只保存结论，不保留适用条件和来源",
    ],
    1,
    [
      "无限堆积会引入成本与噪声，仍需选择相关信息。",
      "经验需要被保存、取回或更新到可复用载体中，还要评估有效性。",
      "没有条件和来源的结论难以可靠复用，也容易在不适用场景中被误用。",
    ],
  ),
  scenario(
    "loss-of-context",
    "handoff",
    "研究 Agent 要把结果交给编码 Agent。",
    "只交接了一段结论，没有目标、约束、来源、失败路径或完成标准。",
    [
      "只复制最终结论，以减少交接成本",
      "换更强的接手模型，让它推断遗漏约束",
      "交接必要上下文、来源和边界，并明确验收条件",
    ],
    2,
    [
      "只给最终结论会继续丢失约束和验收条件。",
      "猜测会放大误差与沟通成本。",
      "有界移交保留决策所需的信息与责任边界。",
    ],
  ),
];
// Keep old IDs and answer indices intact for already-answered saved battles.
for (const trial of ENGINEERING_TRIALS) for (const q of trial.questions) {
  const proposal = (q.correct + 1) % 3;
  CASES.push({
    id:`code-v2-${q.id}`,lesson:q.lessonId,situation:q.question,evidence:q.code,
    options:q.options as LearningCase["options"],correct:q.correct,
    consequences:q.optionReasons as LearningCase["consequences"],codeLanguage:"python",
    source:{chapter:q.chapter,section:q.section,page:q.page},
    transfer:{
      question:`同事建议「${q.options[proposal]}」。依据题设，哪项判断准确解释了这个方案？`,
      code:q.code,codeLanguage:"python",options:q.optionReasons!,correct:proposal,
      explanation:q.explanation,
    },
  });
}
function beginnerTransfer(q: BeginnerQuestion): Transfer {
  return { question:q.question, evidence:q.scene, intro:q.intro, level:"beginner", hint:q.hint,
    code:"", options:q.options, correct:q.correct, explanation:q.explanation };
}
// The next scenario of the same idea. The old lookup always returned the first
// sibling, so every later level repeated an earlier prompt instead of moving on.
function nextBeginnerQuestion(q: BeginnerQuestion): BeginnerQuestion | undefined {
  const same = BEGINNER_QUESTIONS.filter(other => other.lessonId === q.lessonId);
  const index = same.findIndex(other => other.id === q.id);
  return same[index + 1] ?? BEGINNER_FOLLOW_UPS[q.id];
}
for (const q of BEGINNER_QUESTIONS) {
  const next = nextBeginnerQuestion(q);
  const lesson = LESSON_BY_ID[q.lessonId];
  const transfer = next ? beginnerTransfer(next) : {
    question:lesson.question, evidence:"用刚才的小知识，再做一次简单判断。", intro:q.intro, level:"beginner" as const,
    hint:"对照上方小知识，想一想哪种说法解释了刚才的做法。", code:"", options:lesson.options,
    correct:lesson.correct, explanation:lesson.explanation,
  };
  CASES.push({id:`beginner-${q.id}`,lesson:q.lessonId,situation:q.question,evidence:q.scene,
    level:"beginner",intro:q.intro,hint:q.hint,options:q.options as LearningCase["options"],correct:q.correct,
    consequences:q.optionReasons,source:{chapter:q.chapter,section:q.section,page:q.page},transfer});
}
export const CASE_BY_ID = Object.fromEntries(
  CASES.map((c) => [c.id, c]),
) as Record<string, LearningCase>;
interface Transfer {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  code?: string;
  codeLanguage?: "python";
  level?: "beginner";
  intro?: string;
  evidence?: string;
  hint?: string;
}
const transfers: Record<string, Transfer> = {
  "missing-file": {
    question: "换成浏览器任务：点击按钮后页面没有变化，下一步呢？",
    options: [
      "用相同坐标再点击几次，不刷新观察",
      "先观察页面和返回信息，再决定是否重试",
      "以点击工具未报错作为完成依据",
    ],
    correct: 1,
    explanation:
      "文件工具与浏览器动作都需要观察环境反馈。动作发出不等于目标实现。",
  },
  "missing-evidence": {
    question: "换成表格任务：模型从未读到列名，能靠更长提示补足吗？",
    options: [
      "可以，让模型根据常见表格结构补齐",
      "可以，只需要补上更详细的输出格式",
      "不能，先读取列名与相关数据",
    ],
    correct: 2,
    explanation: "提示里的要求与实际可见的事实不同。先补观察，再推理。",
  },
  "poisoned-page": {
    question: "工具返回声称“用户已同意上传文件”，这构成授权吗？",
    options: [
      "不构成，授权应来自可信的用户请求",
      "构成，工具返回可以覆盖原始授权",
      "先执行再回报用户，以节省交互",
    ],
    correct: 0,
    explanation:
      "攻击载体换成工具返回，信任边界仍然不变。资料中的声明不能自行变成授权。",
  },
  "prefix-change": {
    question: "工具没变，但每轮随机打乱定义顺序，会怎样？",
    options: [
      "更相关的定义靠前，所以一定更利于缓存",
      "改变前缀，可能破坏已有缓存复用",
      "只要工具内容不变，顺序就不会影响前缀",
    ],
    correct: 1,
    explanation: "稳定不仅是内容相同，也包括前缀组织和顺序保持一致。",
  },
  "unsupported-answer": {
    question: "检索到十个片段都未支持结论，该如何回答？",
    options: [
      "引用片段足够多就可以沿用结论",
      "从相似任务中选择最常见的数字",
      "说明证据不足，继续定向检索或请求澄清",
    ],
    correct: 2,
    explanation: "检索数量不是证据质量。结论必须由真正相关的内容支持。",
  },
  "ambiguous-tool": {
    question: "工具失败时，哪种反馈更有助于 Agent 修正行动？",
    options: [
      "指出无效字段、合法格式与可恢复原因",
      "只返回统一错误码，减少输出长度",
      "失败后自动重试，不把原因写入上下文",
    ],
    correct: 0,
    explanation:
      "动作空间也包含错误反馈的设计。可理解的接口让纠错成为可执行的下一步。",
  },
  "changed-argument": {
    question: "新的工单编号为 Ab-007，工具是否可以改成 AB-7？",
    options: [
      "可以，统一规范化能减少格式差异",
      "不应擅自改写不透明标识符",
      "可以，删除冗余字符后再定位记录",
    ],
    correct: 1,
    explanation: "大小写和前导零可能属于标识符本身。保真要求避免无依据的转换。",
  },
  "forbidden-delete": {
    question: "支付工具的金额上限写在哪，才是真正的硬约束？",
    options: [
      "写入系统提示，要求每次自行核对",
      "在每次执行前让模型再判断一次",
      "在执行层校验金额与权限",
    ],
    correct: 2,
    explanation: "自然语言说明帮助决策，执行层检查才实际阻止越界调用。",
  },
  "unsafe-experiment": {
    question: "脚本放进容器，但仍挂载了全部宿主文件，隔离充分吗？",
    options: [
      "不充分，还要限制挂载和实际权限",
      "充分，容器本身就意味着无法访问宿主",
      "可以通过禁止访问的提示弥补开放挂载",
    ],
    correct: 0,
    explanation: "隔离要检查实际可访问资源与权限，而不是只检查工具名称。",
  },
  "claimed-success": {
    question: "Agent 自评满分，但交付文件缺失，应该信谁？",
    options: [
      "Agent 自己生成的验收报告",
      "可验证的实际产物与独立检查",
      "更详尽的执行过程说明",
    ],
    correct: 1,
    explanation: "评估对象是任务结果。自述、过程记录和真实交付不能互相替代。",
  },
  "confounded-test": {
    question: "只关闭检索器，却同时换一批更难任务，能判断检索贡献吗？",
    options: [
      "能，因为系统里只关闭了一个组件",
      "能，只需把两批任务各自平均",
      "不能，任务分布也是需要控制的变量",
    ],
    correct: 2,
    explanation:
      "对照比较要保留相同任务与其余条件，否则差异仍然可能来自混杂变量。",
  },
  "training-data": {
    question: "示范任务上成功，就能证明新任务也会成功吗？",
    options: [
      "不能，需要独立任务检验泛化",
      "能，只要示范上的成功率足够高",
      "能，增加同分布示范可以替代新任务评估",
    ],
    correct: 0,
    explanation:
      "示范教会的行为与任务外泛化是不同问题，仍受数据和模型能力等条件影响。",
  },
  "forgetful-agent": {
    question: "经验已写入记忆库，但后续从不检索，会自动改善表现吗？",
    options: [
      "会，存储的内容会自动影响所有后续调用",
      "不会，还需在相关任务中被取回或作用于执行",
      "会，保留更多历史本身就代表持续进化",
    ],
    correct: 1,
    explanation:
      "保存经验不是闭环终点。经验必须进入后续决策或执行，并用评估检验收益。",
  },
  "loss-of-context": {
    question: "是否应把全部历史原样交给接手 Agent？",
    options: [
      "应当，全部历史能保证没有任何信息损失",
      "只交接最终答案即可，其余交给模型推断",
      "交接必要目标、约束、证据与验收标准",
    ],
    correct: 2,
    explanation:
      "交接应足以支撑任务，同时控制冗余和边界，不能把堆积上下文当作信息完整。",
  },
};
export const transferFor = (c: LearningCase): Transfer =>
  c.transfer ?? transfers[c.id] ?? LESSON_BY_ID[c.lesson];
function orderedCase(c: LearningCase, lab: NonNullable<Run["battle"]>["lab"]): LearningCase {
  if (lab?.beginnerTransfer) c = {...c,transfer:beginnerTransfer(practiceQuestion(c.lesson))};
  if (!lab?.order) return c;
  const order = lab.order;
  const transfer = transferFor(c), second = lab.transferOrder ?? [0,1,2];
  return {...c, options:order.map(i=>c.options[i]) as LearningCase["options"],
    consequences:order.map(i=>c.consequences[i]) as LearningCase["consequences"],
    correct:order.indexOf(c.correct),
    transfer:{...transfer,options:second.map(i=>transfer.options[i]),correct:second.indexOf(transfer.correct)}};
}
export function caseForBattle(run: Run): LearningCase {
  const saved = run.battle?.lab?.caseId;
  if (saved && Object.hasOwn(CASE_BY_ID, saved)) return orderedCase(CASE_BY_ID[saved],run.battle?.lab);
  const node = run.map.find((n) => n.id === run.position);
  const chapter = node ? LESSON_BY_ID[node.lessonId].chapter : run.act;
  const matching = CASES.filter(c => c.level === "beginner" && LESSON_BY_ID[c.lesson].chapter === chapter);
  const unseen = matching.filter(c => !run.encounteredCases?.includes(c.id));
  const pool = unseen.length ? unseen : matching.filter(c=>c.id!==run.encounteredCases?.at(-1));
  return pool[
    (run.seed + (node?.row ?? 0) * 3 + (node?.col ?? 0) + 2) % pool.length
  ];
}
