import { LESSON_BY_ID } from "./content";
import type { LearningCase } from "./learning-cases";
import type { TrialQuestion } from "./trials";

export interface LearningHint { focus: string; method: string }

// Reading prompts for the current exercises, independent of answer indices and
// shuffled option order. These guide inspection; explanations remain post-answer.
const EXERCISE_HINTS: Record<string, string> = {
  "agent-observation": "从 decide(messages) 反向追踪：context 实际指向哪个列表？再检查 working_dir 的值有没有进入这个列表。",
  "agent-capability": "先查 action 中的名称是否是 tools 的键，再看 get 的缺省值和 handler 的分支；不要把 get 与方括号取值混用。",
  "agent-runtime-boundary": "沿 proposal 到 execute 的路径找检查点：如果换一个调用者，规则是否仍会在动作发生前执行？",
  "agent-stop": "把工具返回的 done 与最终成功标记放在一起比较，检查成功状态究竟取决于哪个条件。",
  "agent-context-view": "只列出这次模型调用真正收到的参数；磁盘上存在的信息，是否也出现在被读取的输入中？",
  "agent-tool-failure": "对照两种失败进入决策前的表示，看看它们是否还保留足以选择不同恢复路径的信息。",
  "checkpoint-boundary": "先在纸上标出快照已经包含的序号，再逐条检查循环条件是否让这些序号再次进入累计。",
  "checkpoint-rebuild": "分别计算旧规则和新规则覆盖哪些订单，再问：空后缀能否改变快照里已有的旧结果？",
  "checkpoint-publish": "把 count 所代表的已处理范围和 through 放在同一时间线上，检查它们是否属于同一次发布。",
  "checkpoint-evidence": "按执行顺序停在 raise 那一行；区分此前已修改的内存，以及恢复函数实际读取的日志。",
  "checkpoint-event-id": "把输入分成同一事件的重发和不同事件的相同内容两类，检查去重键会把哪两条记录合并。",
  "checkpoint-suffix-contract": "先确认快照与后续日志使用的规则、覆盖范围和前缀是否保持不变，再比较两种恢复的重复工作。",
  "checkpoint-alias": "画出外层字典和内层列表的引用关系，再看 append 修改的是哪一个对象。",
  "checkpoint-determinism": "检查重建计算是否只由保存的证据决定；尝试想象同一日志在两次恢复时能否产生不同结果。",
  "checkpoint-query": "逐项检查记录的类型与查询条件，先列出参与统计的记录，再计算结果。",
  "checkpoint-constraint": "找到状态写入或更新发生的位置，检查题设约束是在该位置之前还是之后验证。",
  "checkpoint-side-effect": "分别列出恢复内部状态和再次执行外部动作的后果；回放记录是否必然意味着重做现实操作？",
  "checkpoint-corrupt": "在采用候选快照之前，列出需要校验的字段与证据，再检查校验失败时是否仍有可恢复的来源。",
  "memory-late-arrival": "把事件发生时间与写入到达时间分成两列，检查排序、覆盖和当前状态各自使用哪个时间。",
  "memory-batch-deadline": "分别跟踪首次入队与后续入队的时刻；持续有新数据时，当前刷新条件会怎样变化？",
  "memory-add-only": "将不可变的原始证据和可更新的整理结果分开，检查策略迁移是否误把两者当作同一类数据。",
  "memory-selective-write": "先写出后续任务需要哪些稳定信息，再衡量每条轨迹是证据、噪声还是值得保留的经验。",
  "memory-user-scope": "检查写入键和读取键是否都包含同一个用户范围；只在一端隔离是否足够？",
  "memory-batch-cost": "数清实际发生了几次提取调用，再分别计算调用固定成本和随输入变化的成本。",
  "memory-rank-fusion": "先比较两路分数的量纲与范围，再区分候选召回、排名融合和重排序各自解决的问题。",
  "memory-entity-filter": "把实体身份与关系字段逐项对齐，检查过滤条件会留下哪些属于当前查询对象的记录。",
  "memory-historical-read": "画一条时间线，在查询时刻截断后再选记录；不要用事后才出现的信息回答历史问题。",
  "memory-read-your-write": "从刚写入的数据出发，分别追踪缓冲区与检索入口；本次读取能看见哪一层数据？",
  "memory-filter-topk": "用一个不符合范围但排名靠前的记录做例子，比较先截取和先过滤对有效候选数量的影响。",
  "memory-query-routing": "先判断问题需要精确字段统计还是语义证据，再检查所选入口是否支持这种查询。",
  "compaction-reserve": "不要只比较当前已用量与上限；把下一次输入、输出和必须预留的空间放到同一预算里。",
  "compaction-mark-commit": "沿失败分支检查标记何时改变，再想象重试时会依据这个标记跳过什么。",
  "compaction-batch-filter": "逐批标出保留与丢弃的条件，注意批次边界和筛选条件的作用对象。",
  "compaction-prefix": "找出两次请求最早发生变化的位置，区分稳定前缀与后面追加的内容。",
  "compaction-thinking": "检查推理记录绑定的是哪一版前缀，再问重写历史后这份记录还满足原来的使用条件吗。",
  "compaction-preview": "先区分可见预览和完整原件，再检查限制常驻长度后是否仍能按需找到任务相关内容。",
  "compaction-task-aware": "检查摘要函数的实际输入是否包含当前任务；不了解目标时，它依据什么判断信息价值？",
  "compaction-semantic": "先从题干提取必须核对的实体、关系与时间，再逐个查看候选摘要还留下了哪些字段。",
  "compaction-source-pointer": "沿 source_id 真正查找一次源对象，区分有引用字符串和能读取对应证据。",
  "compaction-protected": "把题设保护项逐个代入 accept 的条件，看看当前长度检查实际验证了什么、遗漏了什么。",
  "compaction-breaker": "逐次记录失败计数，特别观察成功出现后的状态；区分连续失败与累计失败。",
  "compaction-noise": "检查有效记录位于输入的哪个位置，再比较固定截断、确定性筛选与摘要调用的作用和成本。",
  "tool-normalization": "并列写出请求中 limit 的含义和后端实际使用的值，检查差异是否在调用者可见的合同里说明。",
  "tool-disclosure": "分别数元数据目录的条目与 load_definition 的调用次数，注意两者不是同一类载入。",
  "tool-result-schema": "从调用者看到的返回值出发，试着区分超时和没有匹配项；需要哪些信息才能选择下一步？",
  "tool-protocol-kinds": "先按协议中的能力类型分类，再检查资源里的文字是否真的改变了可执行工具的授权。",
  "tool-structured-errors": "比较成功空结果和失败的表示方式，检查保留什么字段才能稳定地区分两种情况。",
  "tool-stale-definition": "把目录元数据与当前完整定义放在一起，逐项检查当前版本的必填参数是否已经准备。",
  "constraints-path": "把路径拆成组成部分，比较真正的父子目录关系与字符串前缀相同分别意味着什么。",
  "recovery-classification": "将输入的每个状态码逐一代入 retryable，按题设集合判断，不按成功或失败笼统分类。",
  "recovery-budget": "把已经消耗的时间、下一次尝试和返回失败所需的预留时间相加，再与总预算比较。",
  "constraints-validation-order": "按照日志顺序标出校验、拒绝与写入的先后；发生过的外部动作能否靠事后拒绝撤回？",
  "recovery-input-change": "对照错误要求和两次请求的字段差异，看看改变的字段是否影响这次失败的原因。",
  "constraints-test-signal": "从下一次决策的输入反向追踪，看看新检查结果和旧成功信息分别进入了哪里。",
  "events-order": "先写出实际取出的事件顺序，再与创建、取消之间要求的先后约束比较。",
  "isolation-scopes": "列出动作要求的权限与身份实际拥有的权限，逐项核对，而不是只判断是否有部分交集。",
  "isolation-auth-state": "区分认证状态、会话句柄与敏感凭据文本，检查决策流程真正需要等待和传递的是什么。",
  "events-payload": "比较两个通知入队后留下的字段，看看消费端还能否确定各自对应的文档。",
  "isolation-shared-state": "画出两个身份指向的状态对象，检查身份不同是否也意味着可变数据对象不同。",
  "events-observation-before-decision": "标出入队、写入轨迹和调用模型的时间顺序，检查这次决策在何时才能看见新事件。",
  "eval-probabilities": "先用文字写下至少一次成功与每次都成功，再分别考虑失败概率和连乘的含义。",
  "eval-reset-state": "列出运行前后变化的环境状态，再检查第二组评估的初始条件与第一组是否相同。",
  "eval-ablation": "只圈出这次希望衡量的那个改动，列出其他应保持一致的条件，再逐组比较对照方案。",
  "eval-hidden-state": "除任务名称外，逐项检查还会影响结果的可变状态；重新命名是否也清空了这些状态？",
  "eval-correlated-runs": "先核对公式需要的独立性假设，再检查复用同一轨迹是否提供了多次独立运行的证据。",
  "eval-budget-confound": "把成功率与消耗预算放在同一张对照表里，区分观察到的结果和能够单独归因的因素。",
  "training-objective": "逐项查看示范概率如何进入求和；区分负对数似然、奖励与其他统计量。",
  "training-zero-signal": "先计算这一组奖励的均值，再逐项减去均值，检查不同轨迹之间还剩多少可区分信号。",
  "training-path-result": "列出评分器能看见与看不见的动作，检查测试全绿是否足以证明失败路径已被修复。",
  "training-reward-shape": "对照文本里的成功标记与真实执行结果，检查奖励函数实际读取的是哪一种证据。",
  "training-demo-scope": "将训练示范和独立新任务的结果分开统计，再判断每一组结果能支持多大范围的结论。",
  "training-curriculum": "沿 rollout 找到首次失败的位置，先检查动作是否已经能通过接口进入执行，再讨论策略学习。",
  "evolution-carrier": "先列出规则的稳定性、可执行性和覆盖范围，再比较各类经验载体能否满足这些条件。",
  "evolution-holdout": "分别查看目标问题与保留集上的变化；只报告一个目标时，会遗漏哪些原有能力？",
  "evolution-offline-publish": "画出生成候选、验证和切换生效版本的顺序，追踪验证失败后能否仍找到上一个可用版本。",
  "evolution-transfer-gap": "比较示范环境与迁移环境的差异，检查测试是否只重复了候选里写死的那个条件。",
  "evolution-source-retention": "沿每条经验的 source 回查，看看文本相同的两条记录是否也必然来自同一条证据。",
  "evolution-retrieval-loop": "从决策函数真正读取的输入出发，沿路径寻找已保存经验；再想怎样验证它确实影响后续结果。",
  "collaboration-evidence": "列出各审查角色新增了什么观察，区分重复同一说明与获得独立执行证据。",
  "reviewer-independence": "分别标出作者声明和审查器的实际判断条件；最后的通过值由哪个输入决定？",
  "handoff-contract": "从接手者需要完成的动作倒推，逐项检查任务包是否包含必要的目标、约束与验收条件。",
  "handoff-control": "把任务内容与提交权限分开，沿实际提交路径查找身份校验点。",
  "collaboration-stale-artifact": "把被测试产物和最终交付产物的版本列在一起，检查证据是否覆盖同一个对象。",
  "reviewer-check-selection": "先定位需要验证的失败路径，再比较每项审查动作能带来哪一种新的、可观察证据。",
};

// Concept prompts are written separately from the answer/explanation fields.
const LESSON_HINTS: Record<string, string> = {
  agent: "把一次可运行任务拆成三个问题：谁选择下一步、依据什么信息、通过什么接口产生外部变化？对照各方案是否覆盖完整链路。",
  react: "想象工具返回了与你预期不同的结果：进入下一次决策前，当前轨迹还缺哪类新证据？",
  harness: "假设模型知道规则却仍提出错误动作，想想模型之外的运行环境需要在哪些位置发现、阻止或纠正问题。",
  context: "沿关键事实到本次模型输入画一条路径，找出事实第一次缺席的位置；改变指令语气能补上哪一段？",
  cache: "把前后两轮输入并排，找出从开头起第一个不同的位置，再判断后面哪些内容仍能复用。",
  injection: "外部资料中出现命令时，先追溯它由谁提供、原任务授权了什么，再判断文字所在的位置能否自行产生权限。",
  skills: "把发现某项能力和真正使用它分成两步：每一步各需要多少信息，哪些细节可以等到用时再读？",
  compression: "设想接手者只读压缩结果就继续任务：哪些遗漏会使他重犯错误、越过限制或无法核对结论？",
  memory: "比较一次运行中发生的全部事件，与下次会话仍值得调用的信息；两者的保留范围和更新方式需要一样吗？",
  rag: "把尚未掌握外部事实与已有证据可生成回答列成两个状态，尝试排出连接这两个状态所需的步骤。",
  hybrid: "分别想一个关键词必须精确匹配的查询和一个使用同义改写的查询，观察单一路召回可能漏掉什么。",
  aci: "设想调用者第一次接触这个工具：仅凭接口说明，能否判断何时使用、输入什么以及什么情况会失败？",
  fidelity: "把模型看到的请求与后端实际执行的请求逐项对齐；若两者不一致，调用者能否据返回信息定位差异？",
  mcp: "用读取一份文档、触发一次操作、复用一段提示这三个例子分别分类，注意它们是否承担相同职责。",
  discovery: "假设工具数量再增加十倍，分别估算发现入口和一次实际调用各需要加载多少信息。",
  constraints: "设想模型仍然提出越权请求：检查哪种措施能在动作真正发生前约束所有调用者，而不依赖承诺。",
  recovery: "对照错误要求与下一次请求，问自己哪些条件发生变化后才可能成功；只增加尝试次数会改变这些条件吗？",
  isolation: "假设一个身份已经发生错误，沿它能访问的资源和共享状态追踪影响会传播到哪里，再区分预防出错与限制损失。",
  events: "把外部变化发生、运行时接收变化与下一次决策画到时间线上，检查变化通过哪条路径进入决策。",
  pass: "把连续五次都成功拆成五个同时成立的条件；在题设独立假设下逐个组合，最后换算百分比，别与至少一次成功混淆。",
  evaluation: "把两个版本的运行前状态并排比较，想想若前一个版本留下了修改，观察到的差异还能否单独归因给版本。",
  ablation: "分别列出这四个任务里观察到的现象与尚未覆盖的任务范围，思考结论的适用范围能否超过证据范围。",
  sft: "查看两种训练各自如何给一个候选行为打分并更新参数；把直接优化的量与最终希望获得的泛化表现分开。",
  support: "先计算这一批轨迹之间是否存在可区分的成功信号，再沿执行路径定位它们从哪里开始全部失败。",
  reward: "假设绿灯来自减少检查内容，原任务中还有哪些要求没有被这个结果验证？分别检查产物与产生它的动作。",
  evolution: "先判断这条经验是事实、建议还是可以反复执行的确定性规则，再比较不同保存方式能否在每次调用时生效。",
  retention: "为新版本画两列结果：新问题改善了什么、原有能力损失了什么；一次局部提升能否覆盖另一列的变化？",
  sleep: "把在线收集轨迹与整理已有经验分成两个阶段，检查后者要解决哪些重复、冲突和版本问题，而不是只看钟点。",
  collaboration: "逐项列出每个审核动作带来的新增观察；重复同一段说明与接触外部运行结果，在证据上有何差别？",
  reviewer: "分别标出作者的声明与审查者可以独立核对的材料，再问更换作者后，验收标准是否应随之变化。",
  handoff: "沿 A→B→A 画出调用链，逐次扣减剩余资源，看看运行时需要记住什么才能识别重复访问和预算耗尽。",
};

// Frozen saves have no question IDs. Their distinct pseudocode exercises are
// keyed by both lesson and title; ordinary concept questions use LESSON_HINTS.
const LEGACY_HINTS: Record<string, string> = {
  "memory/先写日志": "把原始事实和派生状态分开，检查中断发生在 rebuild 之前时，之后还能从哪里找回输入。",
  "memory/重建检查点": "比较输入只剩最后一条与输入仍包含早期事实两种情况，想想重建后哪些字段还能有依据。",
  "memory/确定性查询": "把年份与国际旅行条件逐条套到 trips 上，想想同一份结构化输入怎样得到可重复的统计。",
  "memory/提取什么": "将稳定偏好与本次工具的瞬时细节分开，判断哪一种信息在未来订票时仍可能有用。",
  "memory/保留历史": "画出搬家前后的时间线，检查保存新事实后，系统是否还需要回答过去住在哪里的问题。",
  "memory/延迟批处理": "观察 buffer 的两个触发条件，比较逐条提取与积累后处理的调用次数及读取时机。",
  "compression/在哪压缩": "先圈出两次 model 调用，检查消息列表在哪个位置可以改变而不改动正在执行的那次调用。",
  "compression/阈值触发": "按代码计算 threshold，再比较 used 与它的关系；注意题干是在复现实验参数，而非规定通用阈值。",
  "compression/防重复处理": "给已经处理过的消息画一个记号，再沿循环判断下一轮如何区分原始结果与已有摘要。",
  "memory/状态与证据": "假设未来要审查一个旧结论，或更换重建规则，比较只剩派生状态与仍能访问输入证据的区别。",
  "memory/约束执行": "题设已经给出日期字段与适用范围，先列出需要比较的量，再判断检查能否重复执行并核对。",
  "memory/冲突检测": "把两组字段并排，逐项查找需要交叉核对的类别，想想怎样使同一输入的检查结果可重复。",
  "memory/混合检索": "把相关性与时间有效性分成两个判断：过去的地址即使很相似，是否就能代表当前事实？",
  "memory/实体消歧": "设想两条同名记录同时存在，检查除了姓名之外，还需要哪些关系或背景才能指向正确的人。",
  "memory/选对存储": "分别为稳定偏好和某次经历写出查询条件，比较它们对主题与时间字段的依赖。",
  "compression/任务感知摘要": "同一批搜索结果若服务两个不同问题，值得保留的部分会一样吗？检查摘要调用获得了哪些筛选依据。",
  "compression/语义完整": "尝试仅凭摘要复原一次具体职位变化，逐项核对哪些参与者、关系和定位信息无法确定。",
  "compression/失败熔断": "沿失败次数增长的路径检查剩余预算，想象达到上限后继续循环与明确退出分别会发生什么。",
  "ablation/控制变量": "先圈出这次唯一希望衡量的模块变化，再比较两组运行的模型、任务、种子与预算是否仍可对照。",
  "handoff/有界移交": "设想接手者只看 payload 就开始执行，逐项检查他是否知道要做什么、受哪些限制以及怎样判断完成。",
};

const CODE_METHOD = "先区分代码现在做了什么和题设要求它做到什么，再比较各方案改变了哪一步。";
const CONCEPT_METHOD = "先明确题目在比较的维度，再用一个具体例子检验每种说法是否满足题设。";

export function practiceHint(lessonId: string): LearningHint {
  return { focus: LESSON_HINTS[lessonId], method: CONCEPT_METHOD };
}

// Deliberately accepts no answer, option or explanation fields.
export function trialHint(question: Pick<TrialQuestion, "id" | "lessonId" | "title" | "code">): LearningHint {
  const focus = (question.id && EXERCISE_HINTS[question.id]) ||
    LEGACY_HINTS[`${question.lessonId}/${question.title}`] || LESSON_HINTS[question.lessonId];
  return { focus, method: question.code ? CODE_METHOD : CONCEPT_METHOD };
}

export function caseHint(c: LearningCase, phase: "action" | "transfer"): LearningHint {
  const id = c.id.replace(/^code-v2-/, "");
  const focus = EXERCISE_HINTS[id] ?? `围绕「${LESSON_BY_ID[c.lesson].title}」，先列出题设证据和当前动作真正读取的信息，再与任务的限制逐项核对。`;
  return {
    focus,
    method: phase === "action"
      ? CODE_METHOD
      : "这一问在判断同事方案的解释。将该方案代入当前证据，检查理由是否对应真实执行路径，而不只是提到了相关术语。",
  };
}
