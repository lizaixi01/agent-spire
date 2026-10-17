// Frozen v1 question bank for in-progress saves. New quizzes use the current bank.
import { LESSONS, LESSON_BY_ID } from "./content";
import type { Trial, TrialQuestion } from "./trials";

const q = (lessonId: string, section: string, page: number, title: string, question: string, code: string, options: string[], correct: number, explanation: string): TrialQuestion => ({
  lessonId, chapter: LESSON_BY_ID[lessonId].chapter, section, page, title, question, code, options, correct, explanation,
});
// Teaching pseudocode paraphrases the supplied PDF; these are not framework APIs.
export const LEGACY_TRIALS: Trial[] = [
  { id: "checkpoint-write", topic: "checkpoint", title: "Checkpoint · 从事实到状态", questions: [
    q("memory", "3.1.4", 77, "先写日志", "会话结束后，事实应该先写到哪里？", "facts = extract(conversation)\n???\nstate = rebuild(allFacts)", ["直接覆盖旧状态，不留证据", "将事实追加到只增日志", "仅保留在当前上下文"], 1, "原文的 User as Code 借鉴预写日志与检查点：先追加事实，再定期重建带类型的状态。日志保留原始证据，状态是可重新生成的派生结果。"),
    q("memory", "3.1.4", 77, "重建检查点", "定期生成检查点时，rebuild 应读取什么？", "log = [factA, factB, factC]\ncheckpoint = rebuild(???)", ["只读最后一句话", "仅凭旧摘要猜测", "读取完整事实日志"], 2, "本节明确从完整日志重建带类型状态。只读取最近一条会丢掉仍有效的早期事实；保留日志使派生状态可以再次构建和审查。"),
    q("memory", "3.1.4", 77, "确定性查询", "检查点有 trips 等带类型字段后，怎样统计某年的国际旅行？", "state.trips: Trip[]\ncountInternational(year)", ["用确定性函数过滤并计数", "让模型每次重新阅读并心算", "把所有旅行压成一句印象"], 0, "User as Code 的关键是把聚合、冲突检测和约束检查交给普通函数。这里过滤年份与国际标记后计数，状态表示与推理共享可验证的代码介质。"),
  ]},
  { id: "memory-write", topic: "memory", title: "Memory · 实现写入管线", questions: [
    q("memory", "3.1", 74, "提取什么", "订票对话结束了，哪种提取结果更适合长期记忆？", "用户：还是靠窗吧，我一向如此。\n工具：本次查询耗时 320ms。", ["保留所有工具输出", "提取稳定座位偏好，舍弃临时耗时", "只记最后一句，不做结构化"], 1, "原文要求选择、抽象和结构化：从一次行为提炼稳定偏好，放弃短期或工具细节，并组织成未来能检索的事实；长期记忆不是聊天记录的完整副本。"),
    q("memory", "3.1.6", 79, "保留历史", "按本书介绍的 Mem0 v3，用户搬家后怎样写入？", "旧事实：2025 住北京\n新事实：2026 搬到上海", ["删除北京记录，抹掉历史", "每条候选都执行第二次 LLM 更新决策", "一次提取，带时间追加上海事实"], 2, "本书所述 v3 采用一次 LLM 提取与 ADD-only 存储；新旧地点和时间并存。它把冲突判断更多交给检索时的相关性与时序，而非写入时覆盖历史。"),
    q("memory", "3.1.6", 79, "延迟批处理", "大量短对话让提取成本过高，Memobase 的做法是什么？", "buffer.push(conversation)\nif sizeLimit || timeLimit:\n    ???", ["批量提取画像与事件，再供查询读取", "每个 token 都单独调用一次模型", "查询时重新处理全部历史对话"], 0, "对话先进入缓冲区，达到规模或时限后统一提取。稳定属性进入画像，具体经历进入事件时间线，批处理摊薄写入成本，查询侧读取已整理的数据。"),
  ]},
  { id: "compaction-trigger", topic: "compaction", title: "Compaction · 实现触发器", questions: [
    q("compression", "2.7.3", 68, "在哪压缩", "Agent 应在什么时候改写消息列表？", "response = model(messages)\nmessages += toolResults\n???\nnext = model(messages)", ["在同一次模型调用中修改输入", "每轮重写 system 与工具定义", "两次调用之间，由框架预处理历史"], 2, "压缩发生在两次 API 调用之间。系统提示与工具定义保持静态；替换历史工具结果会使替换点之后的缓存失效，因此需要控制频次、权衡长度与缓存。"),
    q("compression", "2.7.3", 69, "阈值触发", "复现书中自适应窗口实验：128K 窗口，什么时候批量压缩？", "budget = 128000\nused = 103000\nthreshold = budget * 0.8", ["每轮都压缩全部历史", "超过 80% 时，压缩未标记的工具结果", "超过窗口后继续请求，忽略溢出"], 1, "实验使用 80% 阈值、批量处理未压缩工具结果，以及防重复标记。80% 是该实验的具体参数，不是所有模型的固定规则；生产阈值应结合任务预算设定。"),
    q("compression", "2.7.3", 69, "防重复处理", "下一轮再次超过阈值，如何避免对摘要重复压缩？", "for message in toolResults:\n    if ???:\n        summarize(message)", ["仅处理无 COMPRESSED 标记的消息，成功后打标", "不管标记，重新压缩所有摘要", "删除所有工具结果及其索引"], 0, "原书自适应窗口方案为已压缩内容添加标记，避免重复处理。同一摘要反复压缩会继续损失信息并增加调用成本；批处理只面对尚未压缩的结果。"),
  ]},
  { id: "checkpoint-rules", topic: "checkpoint", title: "Checkpoint · 让状态可执行", questions: [
    q("memory", "3.1.4", 77, "状态与证据", "检查点已经构建完毕，为什么还要保留只增日志？", "facts.log → rebuild → typedState\n下一次需要审查一个旧结论", ["日志只是重复内容，立刻删除", "保留证据，并允许重新生成派生状态", "保证所有第三方动作只执行一次"], 1, "日志与状态职责不同：日志保留事实证据，类型化检查点提供可查询、可执行的派生表示。本节没有声称这个机制单独就能保证外部动作的恰好一次执行。"),
    q("memory", "3.1.4", 78, "约束执行", "状态里有护照到期日和出发日，约束检查应该怎样实现？", "for trip in state.trips:\n    if trip.isInternational:\n        ???", ["等用户再问时才凭印象提醒", "只让模型判断日期是否看起来接近", "用日期函数计算间隔，并触发规则告警"], 2, "原文把护照有效期检查写为普通函数：遍历行程、计算到期日与出发日的差值，再按阈值发出提醒。更新后的状态能够主动接受确定性约束检查。"),
    q("memory", "3.1.4", 77, "冲突检测", "怎样发现用药记录与过敏史之间的冲突？", "profile.medications\nprofile.allergies\ncheckDrugAllergy(profile)", ["函数交叉比对药物类别并报告冲突", "把字段丢弃后用自由文本猜测", "提高温度，让每次判断都不同"], 0, "该节示例把两组类型化对象交叉比对，药物类别匹配时报告冲突。教学重点是让明确的规则由可检查函数执行；现实业务规则仍需由相应专业规范定义。"),
  ]},
  { id: "memory-read", topic: "memory", title: "Memory · 实现检索管线", questions: [
    q("memory", "3.1.6", 79, "混合检索", "事实只追加之后，查询当前住址应该怎样找相关记忆？", "query = 当前住址\nmemories = [北京@2025, 上海@2026]", ["只看向量相似度，忽略时间", "把整个记忆库每次塞进上下文", "融合语义、关键词、实体与时间排序"], 2, "书中 v3 在查询侧融合语义相似度、BM25、实体匹配和时间信息。追加写入保留历史，检索与后续判断据时间及相关性区分当前事实和过去事实。"),
    q("memory", "3.1.3", 76, "实体消歧", "同名的两位联系人都叫李医生，怎么存才能正确检索？", "person: 李医生\n用户自己的医生 / 母亲的医生", ["只用姓名当键，后一条覆盖前一条", "记录人物、关系以及信息获取背景", "删除所有关系，压成一条字符串"], 1, "Advanced JSON Cards 用人物与关系建立实体模型，用 backstory 保留为什么记录这条信息。检索时才有条件区分用户本人和家属的联系人，代价是维护成本更高。"),
    q("memory", "3.1.6", 79, "选对存储", "要同时回答‘我爱吃什么’与‘上次何时谈预算’，怎么组织？", "profile[topic][subtopic]\nevents[timestamp]", ["稳定偏好进画像，带时间经历进事件记忆", "所有内容仅存入偏好字符串", "每次检索只返回最新一条消息"], 0, "Memobase 把稳定属性组织为主题与子主题画像，把经历按时间线记录为事件。两种问题的检索需求不同，明确结构比单纯堆积聊天文本更容易准确调用。"),
  ]},
  { id: "compaction-summary", topic: "compaction", title: "Compaction · 保留可用信息", questions: [
    q("compression", "2.7.3", 69, "任务感知摘要", "面对十页搜索结果，压缩器的输入还应该包含什么？", "summarize(rawResults, ???)", ["仅规定字数越短越好", "当前查询意图与已积累的信息", "无关的通用人物简介模板"], 1, "上下文感知压缩把 query 和 current context 一起放入压缩提示，按当前任务挑选信息。各页面独立泛化摘要会产生重复与碎片，压缩质量不能只看字数。"),
    q("compression", "2.7.5", 71, "语义完整", "把职位变动压缩成‘此人离职了’，缺失了什么？", "原文：某人于 2024 年 5 月离开 A 公司\n摘要：此人离职了", ["只缺更优美的措辞", "缺模型的情绪和语气", "人物、时间、组织与可回查的来源"], 2, "压缩需要保留任务所需的语义关系。原文强调时间与公司名不能随意省去；带引用的压缩还保存源链接，让有损摘要中的事实仍可回溯原始材料。"),
    q("compression", "2.7.4", 70, "失败熔断", "全量压缩反复失败，生产管线下一步应该怎么处理？", "failures += 1\nif failures >= limit:\n    ???", ["停止自动重试，暴露失败供恢复处理", "不设上限，继续烧 token", "把空摘要当成功并删除全部记录"], 0, "书中全量压缩作为最后手段，并配有连续失败熔断器。达到上限后停止自动重试，避免会话陷在反复压缩的付费循环；不能伪造成功或静默抹掉历史。"),
  ]},
];
const implementation = (id: string, title: string, question: string, code: string, options: string[], correct: number, explanation: string) => {
  const l = LESSON_BY_ID[id];
  return q(id,l.section,l.page,title,question,code,options,correct,explanation);
};
const chapters: [number,string,TrialQuestion[]][] = [
  [1,"Agent 运行循环",[
    implementation("agent","连接三要素","给 LLM 加一个聊天框就具备 Agent 的全部运行条件了吗？","decision = llm(context)\nresult = ???\ncontext.append(result)",["还需受控工具执行动作，并回传观察","只需把回答文字变大","给模型更高温度即可"],0,"模型负责决策，上下文提供观察，工具承担可执行动作。运行时要把执行结果返回上下文，下一次调用才有依据调整行动。"),
    implementation("react","处理工具反馈","read 返回文件不存在，循环的下一步怎么实现？","read(path) → not_found\nnextStep = ???",["忽略错误并报告成功","把错误作为观察，再检查路径或目录","不改变任何输入，永远原样重试"],1,"ReAct 在思考、行动和观察之间迭代。错误返回也是新证据，应追加到轨迹，让下一步基于环境反馈调整，而不是只重复原计划。"),
    implementation("harness","执行门控","权限和工具生命周期应在哪一层落地？","model proposes action\n???\nexecute(action)",["只依赖模型承诺","直接执行，再隐藏错误","在 Harness 中验证和控制执行"],2,"Harness 提供工具执行、状态管理与运行边界。LLM 的文字建议不能替代代码中的约束；动作先经过检查，执行结果再进入后续决策。"),
  ]],
  [4,"工具接口实现",[
    implementation("aci","定义工具","工具定义中哪种参数说明更能减少误用？","search(query, scope, limit)",["说明目的、参数含义、边界和返回结果","只写一个很短的函数名","把所有底层接口平铺且不描述"],0,"ACI 需要围绕 Agent 要完成的目标组织接口。明确作用、参数、限制和反馈，才能减少调用者猜测；接口数量多并不代表更容易正确使用。"),
    implementation("fidelity","参数保真","执行器要规范化输入，怎样避免模型看到的与实际执行不同？","model: limit=5\nexecutor: normalize(limit)",["偷偷改成 500 并隐瞒","提前声明规范化规则，并在返回中透明反馈","随意修改所有字段"],1,"工具输入与实际执行要保持可诊断的对应关系。必要的规范化应声明并反馈；静默改参会造成模型无法从自身决策解释的系统性故障。"),
    implementation("discovery","按需发现","工具库扩展到数百个定义，怎么控制常驻上下文？","index = toolCatalog()\nselected = discover(task)\n???",["每轮加载全部定义","删除全部描述","只加载当前需要的工具细则"],2,"工具发现可以先提供索引，再按需获取定义。工具表达形态与披露策略需要分别设计，避免无关接口常驻带来的成本和选择干扰。"),
  ]],
  [5,"约束与故障恢复",[
    implementation("constraints","不可绕过的规则","Agent 提议写入无权限目录，执行器应怎么做？","if not allowed(path):\n    ???",["在程序门控中拒绝并返回清晰错误","忽略检查直接执行","只在提示词里追加请小心"],0,"可由程序检查的权限边界应进入执行门控，并提供可理解的反馈。自然语言指导有价值，但不能承担不可绕过的强制约束。"),
    implementation("recovery","错误分类","同一非法参数持续失败，应怎样恢复？","call(args) → invalid_argument\nretryPolicy = ???",["无限重复同一请求","检查并修改参数，或停止该路径","把失败改写成成功"],1,"恢复策略先区分错误层次和可重试性。参数非法时，原样重试并没有改变失败条件；需要纠正输入或显式停止，让后续决策依据真实状态。"),
    implementation("recovery","有条件重试","网络抖动和权限不足，应该共用无限重试策略吗？","transient_network_error\npermission_denied",["应该，所有错误一样","应该，重试越多越可靠","不应，按可恢复性分类并设置边界"],2,"临时网络故障可能通过重试恢复，权限问题却需要权限或路径条件变化。分类恢复比统一无限重试更可控，也更容易保留失败的真实原因。"),
  ]],
  [6,"事件与隔离运行",[
    implementation("events","事件队列","外部消息到达时，长期 Agent 的循环怎样接收？","event = queue.take()\ntrajectory.append(event)\n???",["基于新事件决策、执行，再等待下一批","永久忽略外部变化","只保留最初一次用户输入"],0,"事件驱动循环从队列接收变化，把它们作为新的观察进入轨迹，再决策与执行。队列和运行时需要维护时序，不能把事件当作无关文字忽略。"),
    implementation("isolation","独立身份","给自动化浏览器运行环境应该怎样分配身份？","agentEnvironment = createEnvironment()",["继承所有用户权限","使用独立身份和隔离环境，限制影响范围","移除一切验证就能保证安全"],1,"独立身份与隔离环境限制错误和泄露的传播范围。它们降低故障影响，但不意味着任务天然正确，仍要验证执行结果和权限边界。"),
    implementation("isolation","用户认证","流程需要用户登录时，哪种设计符合本节边界？","task requires user authentication",["从用户其他会话提取凭据","让模型猜测密码","在可视环境中让用户完成必要认证"],2,"原文将需要用户认证的操作放在用户可见、可控制的环境里完成。自动化身份与用户身份需要明确边界，不能把任务需求视为获取任意凭据的授权。"),
  ]],
  [7,"实现可重复评估",[
    implementation("evaluation","重置环境","比较两个版本前，评估执行器应先做什么？","for version in [A,B]:\n    ???\n    runTasks(version)",["重置数据与环境，使用一致协议和评分","为新版本挑选更容易的任务","仅询问各版本是否成功"],0,"可复现评估要有数据集、可重置状态、工具、评分标准与执行协议。保持初始条件可比较，才有条件判断版本变化带来的收益。"),
    implementation("pass","可靠性指标","单次成功率 0.6，五次独立运行都成功的实现是哪一个？","p=0.6; k=5\nallSuccess = ???",["1-(1-p)**k","p**k","p*k"],1,"全部成功对应 Pass^k，在独立同分布假设下为 p 的 k 次方，约 7.8%。至少一次成功才是 1-(1-p)^k，两个指标不能互换。"),
    implementation("ablation","控制变量","检索模块的消融比较应该怎样设计？","baseline = run(model,tasks,seed,budget)\nvariant = ???",["同时更换模型和任务集","只看新版已成功的任务","保留相同条件，只改变检索模块"],2,"每次检验一个具体变化，固定任务、模型、种子和预算等条件。否则观察到的差异可能来自其他变化，不能据此归因给检索模块。"),
  ]],
  [8,"训练与奖励实现",[
    implementation("sft","优化目标","训练管线要区分 SFT 和 RL，分别优化什么？","SFT: objective = ???\nRL: objective = ???",["示范回答的概率；期望奖励","两者都只增加上下文长度","两者都直接保证任务外泛化"],0,"SFT 学习示范回答，RL 优化期望奖励。实现目标函数与评估泛化需要分开；数据、任务环境和训练条件都会影响最终表现。"),
    implementation("support","全零奖励","所有 rollout 都失败且奖励全零，下一步应怎样设计课程？","rewards = [0,0,0,0]\ntrainingSignal = ???",["默认 RL 会自动凭空学会","诊断能力与接口，补示范或更可达任务","删除失败记录并宣布收敛"],1,"稀疏奖励依赖可发现的成功行为。没有组内差异时，应检查底座能力、接口或课程是否不足，再引入示范、数据或更容易到达的阶段目标。"),
    implementation("reward","结果与路径","Agent 删除失败测试后得到绿灯，奖励器应该怎么判？","tests.pass = true\nactions = [deleteFailingTests]",["无条件给最高奖励","只看最终消息中的自信程度","独立验收交付，并检查违规路径"],2,"最终结果和行动路径要分别验证。确定性的路径惩罚可约束违规行为，但不能替代交付完整性的独立检查；测试变绿本身不足以证明任务解决。"),
  ]],
  [9,"持续进化闭环",[
    implementation("evolution","选择载体","重复出现、可由代码验证的规则应该怎样沉淀？","experience = deterministicConstraint\ncarrier = ???",["加入程序或 Harness 检查","只追加到无限增长的闲聊","把模型自信当作新知识"],0,"知识库、Prompt/Skill、程序/Harness 和模型参数承载不同类型的经验。明确且可执行验证的规则适合程序化约束，并用独立评估检验收益。"),
    implementation("retention","保持与迁移","新规则修好一题后，验收还需要覆盖什么？","candidate fixes taskA\nvalidate(candidate, ???)",["只重跑 taskA","迁移任务与旧能力保留集，同时检查成本和边界","只读取候选自己的总结"],1,"持续进化必须同时考虑更新、迁移和保持。局部成功可能来自过拟合，保留集和迁移集帮助发现旧能力、安全边界或成本方面的退化。"),
    implementation("sleep","离线整合","在线轨迹积累后，离线整理管线怎样实现？","evidence → consolidate → ???",["覆盖所有旧经验，不保留证据","必须等待凌晨才可执行","去重和处理冲突，验证后发布并保留回滚"],2,"离线整合将经验提炼与在线执行分开，处理重复和冲突，保留来源与版本，再验证更新。触发可以依据数量、容量或错误频率，重点不在钟点。"),
  ]],
  [10,"多 Agent 验证与移交",[
    implementation("collaboration","引入新信息","审查 Agent 怎样带来真正的信息增量？","reviewer receives patch\nnext = ???",["运行测试并读取真实产物","只反复复述同一段说明","增加角色数量且不看环境"],0,"多 Agent 的价值来自新证据而非人数。测试、工具返回、渲染结果等外部反馈能够改变判断；重复讨论同一份文本未必带来可靠改进。"),
    implementation("reviewer","独立审查","作者已声明完成，审查者应该依据什么作判断？","author: done\nreviewer: ???",["把声明直接当验收结果","独立检查执行输出、证据与交付物","无条件反对作者即可"],1,"独立审查要基于任务要求与可验证结果，不能把同一模型的自述当作外部证据。独立不等于一味反对，而是用新检查纠正可能的盲区。"),
    implementation("handoff","有界移交","移交工具任务时，接口至少应携带什么？","handoff(payload)\npayload = ???",["只交最终答案，不提供约束","把全部无关历史永久复制","目标、必要上下文、证据、边界和验收标准"],2,"接手方需要足以决策和验收的必要信息，同时由运行时维护控制边界。只交答案会丢失依据，全量堆积历史又会增加噪声和上下文成本。"),
  ]],
];
for (const [chapter,title,questions] of chapters) {
  // Mix application questions with the chapter's existing concept checks.
  const basics = LESSONS.filter(l=>l.chapter===chapter).map(l=>({...l,lessonId:l.id,code:""}));
  LEGACY_TRIALS.push({id:`engineering-${chapter}`,topic:"engineering",title:`第 ${chapter} 章 · ${title}`,questions:[...questions,...basics]});
}
