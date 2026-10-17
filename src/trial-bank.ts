import { LESSON_BY_ID } from "./content";
import type { EngineeringQuestion, Trial } from "./trials";

type Source = [lesson: string, section: string, page: number];
const checkpoint: Source = ["memory", "3.1.4", 77];
const memory: Source = ["memory", "3.1.6", 79];
const compaction: Source = ["compression", "2.7.3", 69];
const problem = (
  id: string, source: Source, kind: EngineeringQuestion["kind"], title: string,
  question: string, code: string, options: [string,string,string], correct: number,
  optionReasons: [string,string,string], explanation: string,
): EngineeringQuestion => ({
  id, lessonId:source[0], chapter:LESSON_BY_ID[source[0]].chapter,
  section:source[1], page:source[2], kind, title, question, code:code.trim(),
  codeLanguage:"python", options, correct, optionReasons, explanation,
});

// Runnable, self-contained exercises. Cursor, publication and deduplication
// contracts are specified by the exercises, not claimed to be APIs in the PDF.
export const ENGINEERING_TRIALS: (Trial & { questions: EngineeringQuestion[] })[] = [
  {id:"checkpoint-write",topic:"checkpoint",title:"Checkpoint · 日志与恢复",questions:[
    problem("checkpoint-boundary",checkpoint,"debug","恢复边界",
      "快照已包含 seq≤2。恢复接口会重发边界记录，且只提供下面两条日志。既保留快照又避免重复累计，应该改哪一行？",`
checkpoint = {"through": 2, "count": 2}
tail = [{"seq": 2, "delta": 1}, {"seq": 3, "delta": 1}]
count = checkpoint["count"]
for event in tail:
    if event["seq"] >= checkpoint["through"]:
        count += event["delta"]
print(count)
`,["保留 count，条件改为 seq > through","将 count 清零，保留 seq >= through","保留 count 和 >=，处理后再推进 through"],0,
      ["through 是已包含的闭区间上界，后缀应从严格大于它的位置开始。","清零会丢掉仅存在于快照中的 seq=1；后缀并不是完整日志。","推进游标发生在重复累加之后，不能撤销边界记录造成的重复。"],
      "当前输出 4，正确恢复应为 3。原书区分原始日志与派生状态；本题用 through 明确快照覆盖范围，考查增量恢复的边界。"),
    problem("checkpoint-rebuild",checkpoint,"tradeoff","规则升级",
      "旧版本统计所有订单，新版本只统计 paid。日志完整保留，要求新旧订单都按新规则重算。应该选哪种重建方式？",`
events = [{"seq": 1, "status": "paid", "amount": 40},
          {"seq": 2, "status": "cancelled", "amount": 60}]
snapshot = {"through": 2, "total": 100, "rule": "v1"}
def rebuild(rows):
    return sum(e["amount"] for e in rows if e["status"] == "paid")
new_tail = [e for e in events if e["seq"] > snapshot["through"]]
print(snapshot["total"] + rebuild(new_tail))
`,["沿用 total=100，只给后续订单套用新规则","从完整日志构建新状态，再发布 v2 检查点","把完整日志的 paid 金额再加到旧 total"],1,
      ["后缀为空，旧规则留下的取消订单仍在总额中。","旧状态依赖旧规则；完整证据允许按新规则重新生成 40。","会把已经包含的付款再加一遍，得到 140。"],
      "日志保留证据，检查点是特定规则的派生结果。只改后续处理无法修正旧检查点中的历史计算，本题的规则版本由题设定义。"),
    problem("checkpoint-publish",checkpoint,"debug","检查点发布",
      "每条日志让 count 加一。这里把新 count 与旧 through 写到同一快照。恢复后打印多少？应如何修复发布协议？",`
log = [{"seq": i, "delta": 1} for i in range(1, 4)]
old = {"through": 2, "count": 2}
published = {"through": old["through"], "count": 3}
restored = published["count"]
for e in log:
    if e["seq"] > published["through"]:
        restored += e["delta"]
print(restored)
`,["输出 3；先把 through 改到 3，再异步保存 count","输出 4；刷新日志文件即可保持两字段一致","输出 4；同一代 count 与 through 作为整体发布"],2,
      ["当前游标仍是 2，会重放 seq=3；先推进游标又可能跳过尚未保存的状态。","日志是否刷新不解决快照中状态与游标属于不同代的问题。","状态包含到哪里，游标就必须指到哪里；一起提交才能避免混代。"],
      "当前恢复为 4。原书给出日志与检查点机制；本题进一步规定检查点的状态和覆盖游标必须属于同一版本，原子发布是该协议的工程要求。"),
    problem("checkpoint-evidence",checkpoint,"trace","中断位置",
      "下面模拟投影更新后、事实入日志前中断。恢复严格从日志重建。恢复值是什么？",`
log = [{"delta": 1}, {"delta": 1}]
projection = 2
try:
    projection += 1
    raise RuntimeError("interrupted")
    log.append({"delta": 1})
except RuntimeError:
    recovered = sum(e["delta"] for e in log)
print(projection, recovered)
`,["3 2：投影已变，但日志尚未记录这条事实","3 3：重建时会自动合并最新投影","2 2：中断会回滚 Python 变量和列表"],0,
      ["异常发生在 append 之前；内存投影与日志现在不一致。","recovered 的输入只有 log，代码并没有读取 projection。","异常不会自动撤销已执行的普通内存赋值。"],
      "先保留事实证据，再生成派生状态，是原书的写入顺序。本题只模拟中断位置，不声称内存列表具备磁盘持久化保证。"),
    problem("checkpoint-event-id",checkpoint,"tradeoff","重发与新事件",
      "接口可能重发同一 event_id；不同 event_id 即使目的地相同也代表不同出行。目标是不重复计数重发，同时保留两次去 Tokyo 的事实。去重键应该是什么？",`
events = [("e1", "Tokyo"), ("e1", "Tokyo"), ("e2", "Tokyo")]
seen = set()
trips = []
for event_id, destination in events:
    if destination not in seen:
        trips.append(destination)
        seen.add(destination)
print(len(trips))
`,["按 destination 去重，保持当前实现","按 event_id 去重，保留两条不同出行","按整段提取文本去重，相同目的地只记一次"],1,
      ["把两次合法出行合并了；相同目的地不代表同一事件。","同一事件重发有同一 ID，真正的新事件有新的 ID，符合题设。","相同文本可能来自不同事件，文本去重同样会吞掉真实次数。"],
      "当前只留下 1 条。事件身份与事实内容是不同维度；本题的重发协议定义了 event_id，原书的只增证据日志并不自动提供这种去重协议。"),
    problem("checkpoint-suffix-contract",checkpoint,"tradeoff","重放成本",
      "快照按 v2 规则计算，日志前缀不会再修改；恢复后只追加相同 v2 的事件。希望减少启动成本，同时维持与全量重建相同结果，应采用哪种方式？",`
events = [{"seq": i, "delta": 1} for i in range(1, 6)]
snapshot = {"through": 3, "count": 3, "rule": "v2"}
tail = [e for e in events if e["seq"] > snapshot["through"]]
def apply(state, rows):
    return state + sum(e["delta"] for e in rows)
print(apply(snapshot["count"], tail))
`,["从 0 重放完整日志，不使用现有快照","沿用 count，并把完整日志再重放一次","校验规则版本和覆盖范围后，仅重放后缀"],2,
      ["结果也能正确，但每次扫描全部历史，不满足减少恢复成本的目标。","快照已经包含前缀，再重放完整日志会重复计数。","在题设的不变前缀与相同规则条件下，快照加后缀能得到同样的 5。"],
      "全量重建适合规则变化或快照失效；增量恢复依赖已验证的覆盖与规则不变。两者的选择需要看题设约束，而不是记住固定口号。"),
  ]},
  {id:"checkpoint-rules",topic:"checkpoint",title:"Checkpoint · 状态与一致性",questions:[
    problem("checkpoint-alias",checkpoint,"debug","快照隔离",
      "本题把内存 snapshot 当作不可变的检查点候选。为什么后续追加行程会修改它？怎样隔离这一候选？",`
from copy import deepcopy
state = {"trips": ["Tokyo"]}
snapshot = state.copy()
state["trips"].append("Seoul")
isolated = deepcopy(state)
print(len(snapshot["trips"]), len(isolated["trips"]))
`,["dict.copy 复制了外层；候选应深复制或序列化以隔离嵌套列表","追加时只修改外层字典的版本号即可隔离列表","把 snapshot 换成 dict(state) 会递归复制列表"],0,
      ["snapshot 与 state 仍共享 trips；深复制或序列化才能隔离本题的嵌套值。","版本号不会切断两个对象对同一列表的引用。","dict(state) 仍是浅复制，与当前问题相同。"],
      "输出为 2 2。类型化派生状态要真正满足快照协议；原书说明状态表示，本题用 Python 引用语义检验不可变候选的实现。"),
    problem("checkpoint-determinism",checkpoint,"debug","可重建性",
      "账单要求按购买时的 unit_price 重建历史金额。下面的重放依赖当前价格表，价格从 10 改成 12 后会发生什么？应该把什么作为事实保存？",`
log = [{"sku": "A", "qty": 2}]
prices = {"A": 10}
def rebuild():
    return sum(prices[e["sku"]] * e["qty"] for e in log)
first = rebuild()
prices["A"] = 12
print(first, rebuild())
`,["20 20；只要日志不变就不会受外部数据影响","20 24；日志保存成交单价或可定位的价格版本","20 24；把当前价格表覆盖进所有旧记录"],1,
      ["重放函数读取了可变的 prices，同一日志会得到不同结果。","重建历史金额需要当时的价格证据，不能只存后来会变的查询键。","会把历史成交价改成当前价，违背题目要求的历史口径。"],
      "检查点可由证据重建的前提，是保留足以再现目标结果的事实。本题的价格口径由业务要求给定，不把最新外部值当作历史事实。"),
    problem("checkpoint-query",checkpoint,"trace","类型化统计",
      "目标是统计 2025 年国际行程的次数，不是目的地数量。代码输出多少？",`
from datetime import date
trips = [("Tokyo", date(2025, 1, 3), True),
         ("Tokyo", date(2025, 5, 8), True),
         ("Osaka", date(2024, 8, 1), True),
         ("Beijing", date(2025, 2, 2), False)]
answer = sum(d.year == 2025 and international for _, d, international in trips)
print(answer)
`,["1：同一目的地应先合并","3：2025 年有三条行程记录","2：按年份与国际标记过滤后逐条计数"],2,
      ["这是不同目的地的计数口径，会合并两次独立旅行。","其中一条不是国际行程，不能只过滤年份。","两个 Tokyo 记录都符合两个条件，所以统计为 2。"],
      "原书用带类型的行程与确定性函数完成聚合。字段使统计口径可明确检查，但类型本身不会替你选择正确的过滤条件。"),
    problem("checkpoint-constraint",["memory","3.1.4",78],"debug","约束边界",
      "题设要求出发时护照剩余有效期至少 180 天。为什么下面会把相差 60 天的行程视为可用？",`
from datetime import date
expiry = date(2026, 3, 2)
departure = date(2026, 1, 1)
days = (expiry - departure).days
def allowed(days):
    return abs(days) < 180
print(days, allowed(days))
`,["比较方向错了，应检查 days >= 180，并保留差值的正负","只需改成 abs(days) >= 180，仍应忽略日期方向","把 days 四舍五入成月数，再检查是否小于 6"],0,
      ["题设是下界要求；负数还表示出发前已过期，不能取绝对值。","过期 200 天也会被 abs 变成正 200，从而错误通过。","月份长度不固定，而且小于 6 仍把下界判断反向。"],
      "代码输出 60 True，但应判为不满足约束。原书展示在类型化状态上运行日期函数；判断方向与边界仍须通过具体数据验证。"),
    problem("checkpoint-side-effect",checkpoint,"tradeoff","状态恢复与外部动作",
      "支付服务允许传入 idempotency_key。执行器在扣款后、保存游标前中断，恢复会再处理同一 order_id。怎样避免第二次扣款？",`
payments = []
def charge(order_id):
    payments.append(order_id)
order_id = "order-17"
charge(order_id)
# interrupted before saving the checkpoint
charge(order_id)
print(len(payments))
`,["把检查点频率提高到每条事件一次","使用稳定 order_id 调用服务的幂等接口，并保存结果","在扣款之前先推进游标，不再记录外部结果"],1,
      ["仍存在扣款已发生但游标未落下的窗口，只是窗口更短。","同一操作重试使用同一键，由题设中的服务去重，才能覆盖这个窗口。","中断可能留下已经标完成却根本没有扣款的订单。"],
      "日志与检查点负责状态恢复，不能单独保证外部动作只发生一次。幂等接口是本题明确提供的外部条件，不是原书对检查点的无条件保证。"),
    problem("checkpoint-corrupt",checkpoint,"tradeoff","损坏候选",
      "候选快照文件写到一半，但完整日志仍可读。接口要求恢复一个有证据的 count，不得把损坏文件当作有效状态。哪条路径最合适？",`
import json
raw = '{"through":3,"count":'
log = [{"delta": 1}, {"delta": 1}, {"delta": 1}]
try:
    state = json.loads(raw)
except json.JSONDecodeError:
    state = {"count": sum(e["delta"] for e in log)}
print(state["count"])
`,["补齐 JSON 为 count=0，继续只处理未来记录","从损坏文件中读出 through=3，跳过前三条日志","拒绝该候选，从完整日志重建并重新发布"],2,
      ["格式补齐不提供业务值证据，count=0 会丢掉三条有效事实。","只有游标而无相配状态会让前三条事实永久漏算。","完整日志仍在，派生检查点损坏不必等同于事实丢失。"],
      "代码恢复为 3。可重建的派生状态允许从损坏快照回退；候选校验与发布协议是围绕原书机制设计的工程练习。"),
  ]},
  {id:"memory-write",topic:"memory",title:"Memory · 写入与时间",questions:[
    problem("memory-late-arrival",memory,"debug","时间字段",
      "查询的是当前住址。最后收到的消息在回忆旧住址，并非再次搬家。为什么按 received 排序会出错？应该依据哪个字段判断事实的新旧？",`
facts = [
    {"city": "Shanghai", "valid": "2026-03", "received": "2026-03-01"},
    {"city": "Beijing", "valid": "2025-01", "received": "2026-04-01"},
]
latest = max(facts, key=lambda f: f["received"])
current_city = latest["city"]
print(current_city)
`,["按 received；最后说出的事实总能覆盖早期事实","按 valid 判断生效时间，received 另外保留作溯源","按城市词的向量相似度选出最接近当前住址的一条"],1,
      ["后到达的内容可以描述过去，接收顺序与事实生效顺序不同。","上海的事实从 2026-03 生效；北京记录是旧事实的迟到输入。","两条都在回答住址，语义相似本身不能区分有效时间。"],
      "当前输出 Beijing。书中 v3 保留带时间的历史并在检索时推理；本题区分 valid 与 received，防止将接收时间误当成业务时间。"),
    problem("memory-batch-deadline",memory,"debug","刷新条件",
      "约定累计 100 条或最旧消息等待满 10 秒，任一条件满足就刷新。低流量时下面的调度有什么问题？",`
size = 3
oldest_age_seconds = 15
def should_flush(size, age):
    return size >= 100 and age >= 10
ready = should_flush(size, oldest_age_seconds)
print(ready)
`,["保留 and，把超时阈值调低到 5 秒","只检查 size，交给更大的批次摊薄成本","将 and 改为 or，分别满足容量或时限即可刷新"],2,
      ["只要 size 不达标，再低的超时阈值也不能让 and 成立。","减少调用次数，但低流量时可能一直不整理，违反时限约定。","当前 False 应为 True；or 同时覆盖高流量与低流量的触发路径。"],
      "Memobase 使用规模或时限触发缓冲批提取。题设给出具体阈值，考查条件组合如何影响延迟与成本，而不是背批处理的名称。"),
    problem("memory-add-only",memory,"tradeoff","写入策略迁移",
      "产品需要既能问当前住址，也能问去年住址。要实现原书所述的 v3 仅追加方案，应把当前覆盖式写入改成什么？",`
store = {"city": {"value": "Beijing", "at": "2025-01"}}
new_fact = {"value": "Shanghai", "at": "2026-03"}
store["city"] = new_fact
history = list(store.values())
print(len(history), history[0]["value"])
`,["追加带时间的事实，查询时按问题与时间选择","继续覆盖，只把旧记录的向量留在索引里","新增记录后立即按 city 字段合并，只保留最新一条"],0,
      ["保留北京与上海两条证据，才能同时支持当前与历史问题。","索引指向的事实正文已被替换，向量不能还原旧住址。","最终仍只留一条；减少冗余的代价是丢失历史问答需要的证据。"],
      "当前只保留 1 条 Shanghai。覆盖式 v2 有保持简洁的取舍，但不是本题要求的 v3 仅追加与检索时推理方案。"),
    problem("memory-selective-write",["memory","3.1",74],"tradeoff","提取粒度",
      "用户明确说‘我一直选靠窗，这次去 Tokyo’。下次订票要复用稳定偏好，也要能回忆这次行程。哪种写入能区分这两种用途？",`
conversation = {"seat": "window", "habit": True, "destination": "Tokyo"}
profile = {}
events = []
profile.update(conversation)
events.append({"destination": conversation["destination"]})
print(sorted(profile), len(events))
`,["画像保存全部三个字段，事件只存会话编号","画像保存 seat=window；Tokyo 作为带时间的出行事件","将 seat 与 Tokyo 合成一个长期偏好字段供向量检索"],1,
      ["临时目的地被固化进稳定画像，还丢掉事件本身的内容。","稳定属性与具体经历分别组织，支持不同的后续查询。","混合成一个偏好会把本次行程误当成长久偏好，难以区分时间。"],
      "选择性、抽象化和结构化要一起落地。将稳定属性放进画像、将经历放进事件，是本题明确的两种查询需求对应的存储取舍。"),
    problem("memory-user-scope",["memory","3.1.3",76],"debug","写入命名空间",
      "后台合并处理多个用户的记忆。字段同名导致 Alice 被 Bob 的值覆盖，怎样调整键才能保留可查询的用户边界？",`
rows = [("alice", "seat", "window"), ("bob", "seat", "aisle")]
profile = {}
for user_id, field, value in rows:
    profile[field] = value
alice_seat = profile.get("seat")
print(alice_seat)
`,["按 value 建键，检索时猜测它属于哪个用户","按会话接收时间排序，只给每个字段保留最新值","以 user_id 与 field 共同定位，时间与证据另存"],2,
      ["相同偏好可以属于多个人；值本身不能表示身份。","时间只能确定哪条较新，不能解决不同用户的实体冲突。","身份与属性形成作用域，才能分别回答 Alice 和 Bob 的问题。"],
      "当前返回 aisle，属于 Bob。原书强调实体、关系与获取背景；本题将实体边界具体化为存储键，避免同名字段碰撞。"),
    problem("memory-batch-cost",memory,"trace","写入成本",
      "8 段对话同时到达同一用户的缓冲区，flush 结束时成功提取。后续查询只读已整理数据。一次查询会触发几次 extract？",`
calls = []
buffer = ["turn-" + str(i) for i in range(8)]
def extract(batch):
    calls.append(len(batch))
    return {"seat": "window"}
profile = extract(buffer)
answer = profile["seat"]
print(calls, answer)
`,["总共一次，处理 8 段；查询不再次提取","共 8 次，因为每段对话都需要独立持久化","查询时再提取一次，写入与查询各调用一次"],0,
      ["extract 在查询之前执行一次，calls=[8]；查询只访问 profile。","批提取将 8 段合并给一次 extract，并不是循环调用八次。","代码的查询路径没有 extract，额外调用不是该管线的行为。"],
      "写入批处理摊薄模型调用，查询读取已整理的画像与事件。收益与缓冲产生的可见延迟需要一起评估，不能把低查询延迟误解为每次现算。"),
  ]},
  {id:"memory-read",topic:"memory",title:"Memory · 检索与一致性",questions:[
    problem("memory-rank-fusion",["hybrid","3.2.4",87],"tradeoff","分数与名次",
      "两个后端仅保证各自名次有意义，分数尺度会变化。要让两路等权贡献，并偏好都排在前面的候选，下列合并方式哪种符合约定？",`
semantic = {"A": 0.92, "B": 0.88, "C": 0.10}
bm25 = {"B": 8.0, "A": 6.0, "C": 100.0}
combined = {k: semantic[k] + bm25[k] for k in semantic}
ranked = sorted(combined, key=combined.get, reverse=True)
print(ranked[0])
`,["原始分数直接相加，以保留 BM25 的数值优势","把语义结果放前面，再拼接关键词结果去重","分别取名次，用同一常数的 RRF 融合再重排"],2,
      ["当前 C 被 100 的尺度推到第一，不符合两路等权的约定。","次序偏向第一路，不构成两路同等贡献的融合。","RRF 在排名上融合，无需假设两种分值可直接相加。"],
      "两路召回互补，融合与重排职责分开。本题不把 RRF 当作所有任务的唯一最优算法，而是在只有名次可比的接口条件下选可用方案。"),
    problem("memory-entity-filter",["memory","3.1.3",76],"debug","关系检索",
      "用户问‘母亲的李医生电话’。列表里两人同名，应该补充哪个检索条件？",`
cards = [{"name": "Li", "for": "self", "phone": "111"},
         {"name": "Li", "for": "mother", "phone": "222"}]
def lookup(name):
    return next(c for c in cards if c["name"] == name)
result = lookup("Li")
print(result["phone"])
`,["同时匹配 name 与 for=mother，保留来源背景","对同名结果按写入时间取最新一条","增大向量相似度权重，仍只把 Li 作为查询实体"],0,
      ["题目需要的是关系限定后的实体，而不仅是同名实体。","最新联系人未必是母亲的联系人，时间不能代替关系。","两个对象同名；没有关系条件，调权重不能保证消歧。"],
      "当前返回 111，正确目标是 222。Advanced JSON Cards 中的 person、relationship 与 backstory 为这类消歧提供信息。"),
    problem("memory-historical-read",memory,"trace","历史切片",
      "query_at 是用户问‘当时住哪里’的日期，valid 表示开始生效日期。代码会输出哪个城市？",`
facts = [("Beijing", "2025-01"), ("Shanghai", "2026-03")]
query_at = "2025-08"
eligible = [f for f in facts if f[1] <= query_at]
answer = max(eligible, key=lambda f: f[1])
latest = max(facts, key=lambda f: f[1])
print(answer[0], latest[0])
`,["Shanghai Shanghai：追加存储只返回最新事实","Beijing Shanghai：历史问题与当前问题使用不同时间范围","Beijing Beijing：旧事实存在就一直优先使用旧事实"],1,
      ["先按 query_at 限定范围，未来的上海记录不在历史候选内。","历史候选只有北京；全量最新事实则是上海。","当前查询仍应识别后来的有效变化，保留历史不等于忽略更新。"],
      "同一组追加事实能回答不同时间的问题，前提是查询明确时间语义。不能把全局最新一条当作所有查询的固定答案。"),
    problem("memory-read-your-write",memory,"tradeoff","缓冲可见性",
      "用户刚改偏好，随即要求按新偏好订票；这条操作要求读到刚提交的值。定时任务尚未刷新，该用户可在预算内完成一次提取。该怎么处理？",`
profile = {"seat": "window"}
buffer = [{"seat": "aisle"}]
def query():
    return profile["seat"]
before_flush = query()
print(before_flush, len(buffer))
`,["继续读现有画像，等待全局定时刷新以降低成本","强制刷新全部用户的缓冲区，再执行本次查询","对该用户刷新并等待成功后查询，承担这次提取延迟"],2,
      ["可以降低成本，但当前会返回旧值，违反本次读到新值的要求。","也可能得到新值，却引入无关用户的提取成本与等待。","把即时可见性需求限制在该用户，明确用写入等待换取新鲜度。"],
      "批处理降低平均写入成本，但会带来可见延迟。原书的管线并不自动承诺所有查询即时读取缓冲中的新事实，本题明确增加这项一致性要求。"),
    problem("memory-filter-topk",memory,"debug","过滤位置",
      "检索只允许请求一次、返回 2 条。本轮给 Alice 的候选被 Bob 占满，过滤后为空。要稳定得到 Alice 的前两条，过滤应在哪发生？",`
ranked = [("bob", 0.99), ("bob", 0.98),
          ("alice", 0.97), ("alice", 0.96)]
top2 = ranked[:2]
visible = [r for r in top2 if r[0] == "alice"]
fallback = "no memory" if not visible else "use memory"
print(len(visible), fallback)
`,["在召回范围中先限定 Alice，再取 top-2","保持全局 top-2，只调整回答生成的提示词","取全局 top-2 后按 user_id 重排序而不改变候选"],0,
      ["作用域过滤在截断之前，才不会让其他用户耗尽候选名额。","提示词不能补回已经没有进入候选集的 Alice 记录。","重排序只能改变已有候选的顺序，不能产生被截断的记录。"],
      "实体与元数据条件需要落实到检索边界。候选池为空可能是召回与过滤顺序的问题，不一定是记忆提取失败。"),
    problem("memory-query-routing",memory,"tradeoff","检索入口",
      "用户问‘上次讨论预算是什么时候’，画像仅存稳定偏好，事件库按时间记录主题。以下查询应走哪条路径？",`
profile = {"currency": "CNY", "risk": "low"}
events = [{"topic": "budget", "at": "2026-05-01"},
          {"topic": "travel", "at": "2026-06-01"}]
answer = profile.get("last_budget_at")
event_count = len(events)
print(answer, event_count)
`,["返回画像最后更新时间，近似替代预算讨论时间","在事件库筛选 budget，再按事件时间取最近一次","在全部事件中取最新一次，避免增加主题过滤"],1,
      ["画像更新时间可能来自别的偏好变化，与预算事件没有必然关系。","问题同时限定主题与时间，事件结构能提供这两个维度。","最新事件是 travel，满足时间最新却不满足 budget 条件。"],
      "存储画像和事件是为了支持不同的查询形态。检索入口选择错误时，扩大模型或上下文不一定能解决缺少正确候选的问题。"),
  ]},
  {id:"compaction-trigger",topic:"compaction",title:"Compaction · 预算与触发",questions:[
    problem("compaction-reserve",compaction,"debug","下一次调用预算",
      "当前 prompt 未达实验中的 80% 阈值，但下一次工具结果上限为 28000 token，还需预留 12000 输出。哪种判定能覆盖这次溢出风险？",`
window = 128000
used = 92000
next_tool_limit = 28000
output_reserve = 12000
threshold_hit = used > window * 0.8
projected_overflow = used + next_tool_limit + output_reserve > window
print(threshold_hit, projected_overflow)
`,["只按当前 80% 阈值触发，工具返回后再判断","同时评估预计新增与输出预算，必要时提前减量或限制工具返回","仅把输出预留从 12000 降到 8000，保持工具返回上限"],1,
      ["当前 False，但预计总量为 132000，等工具返回后才处理会失去提前控制机会。","把下一步增长计入预算，能在调用前发现风险并选择压缩或输出限额。","92000+28000+8000 恰好顶满窗口，没有余量且改变了题设的输出要求。"],
      "当前输出 False True。原书 80% 是实验参数；工程触发要结合实际输入增长与预算。本题给出的最坏情况额度不是某个供应商的默认参数。"),
    problem("compaction-mark-commit",compaction,"debug","失败后的标记",
      "摘要服务本轮抛出异常。下一轮只扫描 compressed=False 的消息。怎样调整标记时机，避免原文再也无法被处理？",`
message = {"text": "long tool output", "compressed": False}
try:
    message["compressed"] = True
    raise TimeoutError("summary service")
    message["text"] = "short summary"
except TimeoutError:
    pass
print(message["compressed"], message["text"])
`,["摘要成功并校验后，再一起提交新内容和 compressed 标记","继续提前打标；只把超时次数记录到独立计数器","在下一轮允许所有已标记的消息再次进入压缩"],0,
      ["失败保留原文与未完成状态，重试不会被错误的成功标记跳过。","失败计数不会改变 compressed=True 的筛选结果，消息仍被漏掉。","能重新看到失败项，却也反复处理所有成功摘要，失去防重复保护。"],
      "原书的标记是防止已压缩内容重复处理；它应表达成功完成，而不是开始尝试。本题将完成状态的提交时机具体化。"),
    problem("compaction-batch-filter",compaction,"trace","批次筛选",
      "采用书中批量压缩未标记工具结果的方案。下列一轮选择哪些 id？",`
messages = [{"id": 1, "role": "system", "done": False},
            {"id": 2, "role": "tool", "done": True},
            {"id": 3, "role": "tool", "done": False},
            {"id": 4, "role": "tool", "done": False}]
selected = [m["id"] for m in messages
            if m["role"] == "tool" and not m["done"]]
print(selected)
`,["[2, 3, 4]：批量处理所有工具消息","[1, 3, 4]：批量处理所有未完成消息","[3, 4]：同时满足工具角色与未完成条件"],2,
      ["id=2 已完成，重复处理它违反防重复规则。","id=1 是静态系统提示，不属于本轮工具结果压缩对象。","两个条件取交集，既保留静态前缀又跳过已压缩结果。"],
      "批量不等于不加区分地处理全部历史。角色范围与完成标记必须同时进入筛选条件，不能只实现其中之一。"),
    problem("compaction-prefix",["compression","2.7.3",68],"tradeoff","缓存变化点",
      "下面用共同前缀长度模拟缓存可复用边界。只修改索引 2 的工具结果，索引 3 的文本虽然相同，为什么不能继续按旧前缀复用？",`
old = ["system", "tools", "raw-result", "answer"]
new = ["system", "tools", "summary", "answer"]
shared = 0
for a, b in zip(old, new):
    if a != b:
        break
    shared += 1
print(shared)
`,["应复用 0、1、3，因为这些文本逐项相同","只复用 0、1；后续项依赖已经变化的前缀","所有索引都失效，因为压缩总会清空全部缓存"],1,
      ["缓存位置依赖前面的内容，不是按孤立消息正文独立匹配。","共同前缀到变化点前截止，索引 3 不能跳过变化点继续复用。","变化前的静态前缀仍相同，不必假定全部缓存都失效。"],
      "原书说明替换位置之后的缓存失效、之前的仍有效。这里的列表只是可执行的边界示例，不模拟实际模型的 KV 张量。"),
    problem("compaction-thinking",["compression","2.7.3",68],"tradeoff","推理前缀约束",
      "题设模型把 thinking 绑定到产生它的完整前缀，且这里没有服务端压缩接口。摘要替换旧历史后，哪种发送方式符合该约束？",`
old_prefix = ("system", "raw history")
thinking = {"bound_to": old_prefix, "text": "previous reasoning"}
new_prefix = ("system", "history summary")
can_reuse = thinking["bound_to"] == new_prefix
recent_turns = [thinking]
print(can_reuse, len(recent_turns))
`,["把会话压为摘要，不回传旧 thinking，再从摘要重新推理","保留最近两轮 thinking，只有更早的 thinking 才依赖旧前缀","只截短工具结果，不改 thinking 文本就能保持绑定有效"],0,
      ["本地前缀已经改变，移除旧 thinking 才满足题设的绑定约束。","最近的 thinking 产生时也依赖原始历史，不因它较新而例外。","截短工具结果同样修改了前缀，thinking 文本没变也不代表绑定没变。"],
      "原书针对前缀绑定模型给出的一个做法是整段摘要并重新推理。不能把保留最近几轮当成对所有模型都有效的通用压缩模板。"),
    problem("compaction-preview",["compression","2.7.4",70],"tradeoff","大输出预览",
      "工具结果有 20 万字符，后续只偶尔取细节。希望降低常驻上下文成本，并让已经进入前缀的预览保持稳定。哪种落地方式更合适？",`
raw = "row=" + "x" * 200000
disk = {"tool-17.txt": raw}
message = {"path": "tool-17.txt", "preview": raw[:80]}
next_round = dict(message)
print(len(message["preview"]), len(disk[message["path"]]))
`,["每轮按当前问题重新改写同一条历史预览，文件只存最新版本","只截断返回值而不保留原件；需要细节时重新调用工具","原件落盘，消息保留稳定预览与定位指针，需要时读取细节"],2,
      ["动态重写旧预览会不断改变历史前缀，文件覆盖还会改变指针含义。","常驻文本短了，但工具不一定可重跑或复现，细节证据可能丢失。","把大结果移出常驻上下文，同时保留可回查来源，预览替换决策固定。"],
      "原书分层压缩先做工具结果预算控制：原件落盘、摘要预览，并冻结替换决策以维护缓存一致性。文件保存与检索能力是题设提供的条件。"),
  ]},
  {id:"compaction-summary",topic:"compaction",title:"Compaction · 摘要与失败恢复",questions:[
    problem("compaction-task-aware",compaction,"debug","压缩提示输入",
      "同一批材料分别用于‘追踪任职变化’与‘了解研究背景’。当前缓存只按原文缓存同一摘要，两种任务拿到相同内容。应该如何改压缩器的输入与缓存键？",`
raw = "career timeline and research notes"
cache = {}
def compress(query, context):
    key = raw
    cache.setdefault(key, "general biography")
    return cache[key]
print(compress("career changes", "known roles"))
print(compress("research", "known papers"))
`,["摘要输入仍只传 raw，仅把输出字数上限减半","把 query、相关已知信息纳入摘要输入，并纳入对应缓存键","保留同一缓存键，生成阶段追加更详细的任务指令"],1,
      ["字数变化不补充任务意图，摘要仍无法按不同目标筛选信息。","内容取舍依赖查询和已有信息，这些输入改变时不能复用同一旧摘要。","生成提示不能从摘要中恢复已经被泛化掉的材料细节。"],
      "原书上下文感知压缩给定 query 与 current context。缓存也要遵守压缩结果的真实依赖，否则任务感知接口只是表面上存在。"),
    problem("compaction-semantic",["compression","2.7.5",71],"trace","字段保留",
      "任务是核对 A 公司某人的任职区间，下面三个候选哪个仍能支持核对离职时间与公司？",`
event = {"person": "Lin", "company": "A", "left_at": "2024-05"}
summaries = [
    {"person": "Lin", "company": "A", "status": "left"},
    {"person": "Lin", "left_at": "2024-05"},
    {"person": "Lin", "company": "A", "left_at": "2024-05"},
]
print([sorted(s) for s in summaries])
`,["候选 3：保留人物、公司和离职时间","候选 1：有公司和状态，时间可按当前日期补齐","候选 2：有时间和人物，同名公司的缺失可由模型推断"],0,
      ["三个用于核对的关键字段都存在，可支持任务要求的比较。","当前日期不是历史离职日期，不能作为被删除时间的替代证据。","缺少公司就无法确认同一人的哪一段任职，推断并不等于证据。"],
      "语义完整性取决于任务需要哪些关系与字段。摘要读起来通顺，仍可能删掉后续判断不可缺少的关键事实。"),
    problem("compaction-source-pointer",compaction,"tradeoff","可回查来源",
      "压缩结果使用本地 source_id 回查，不可重新访问原网页。清理任务现在只保留摘要，会造成什么？哪种保留策略符合可回查要求？",`
sources = {"s17": "full evidence including date and company"}
summary = {"text": "Lin left A", "source_id": "s17"}
sources.clear()
available = summary["source_id"] in sources
reference = summary["source_id"]
print(reference, available)
`,["保留 source_id 即可，它本身包含原始证据","把 source_id 写进 system prompt，可恢复清理掉的证据","保留可解析的源记录或归档对象，并与摘要共同维护引用"],2,
      ["标识符只是索引，不包含原文；对应源记录被清理后就成了悬空引用。","改变标识符所在提示层级不会重新生成被删除的原始事实。","有损摘要加无损定位索引，需要索引的目标仍然可访问才成立。"],
      "原书带引用摘要保留回溯路径。题设限定本地离线来源，因此需要保留可访问的源对象；并非只要看见一个引用字符串就能验证事实。"),
    problem("compaction-protected",["compression","2.7.5",71],"debug","摘要验收",
      "任务仍必须遵守 region=EU 和 budget=50。下面的验收只看 token 数，接受了缺字段的摘要。怎样验证本题中结构化的保护项？",`
required = {"region": "EU", "budget": 50}
candidate = {"summary": "deploy service", "region": "EU", "tokens": 20}
def accept(c):
    return c["tokens"] < 100
accepted = accept(candidate)
missing = set(required) - candidate.keys()
print(accepted, sorted(missing))
`,["只提高压缩率，把摘要的 tokens 再降一半","核对必要字段和值，不满足就拒绝候选并保留原记录","只检查 region 存在，因为新近提到的信息更可靠"],1,
      ["更短不会补回 budget，长度指标不能替代语义约束。","保护项已由题设结构化给出，可做确定性验收并避免静默丢失。","region 与 budget 都是未解除的约束，时间新旧不改变其必要性。"],
      "原书指出早期决策、约束理由和失败路径容易在压缩时丢失。本题用显式字段验证演示如何把这一原则落成可检查的验收条件。"),
    problem("compaction-breaker",["compression","2.7.4",70],"debug","连续失败计数",
      "熔断约定为连续失败 2 次才停止。给定失败、成功、失败、成功，这段代码在第 3 次就停止。如何修复而不放宽熔断阈值？",`
failures = 0
stopped_at = None
for attempt, ok in enumerate([False, True, False, True], 1):
    if not ok:
        failures += 1
    if failures >= 2:
        stopped_at = attempt
        break
print(stopped_at)
`,["成功后把连续失败计数清零，失败时才递增","保留累计失败计数，把阈值增加到 4","仅改为按总尝试次数停止，去掉失败计数"],0,
      ["成功会打断连续失败序列；这组输入应一直不触发连续两次失败。","这变更了题设阈值，仍然把分散的失败误当成连续失败。","总次数上限可作为另一层预算，但不能实现本题约定的连续失败熔断。"],
      "原书的熔断针对连续压缩失败，避免无效循环。需要分别理解连续失败上限、总尝试次数与总预算，不能混用一个计数器。"),
    problem("compaction-noise",["compression","2.7.4",70],"tradeoff","分层取舍",
      "当前任务只需错误码和配置约束。1000 行导航噪声已确认无用，原件已归档且可回查，只有两条有效记录。怎样控制常驻上下文的成本更合适？",`
records = [{"kind": "nav", "text": "menu"}] * 1000
records += [{"kind": "error", "text": "E42"},
            {"kind": "constraint", "text": "region=EU"}]
preview = records[:100]
useful = [r for r in preview if r["kind"] != "nav"]
print(len(preview), len(useful))
`,["对所有导航逐条调用摘要模型，再拼接成短文","固定保留前 100 行，剩余信息需要时从头重新检索","删除已确认噪声，保留有效记录与归档定位，必要时再做语义摘要"],2,
      ["为已确认无用的噪声付出摘要调用，不增加当前任务需要的信息。","当前前 100 行全是噪声，有效记录恰好被截掉，不能只靠固定头部截断。","先使用确定性的预算与噪声处理，再对剩余有价值的信息做更贵的压缩。"],
      "原书分层机制先做预算控制、噪声删除，再考虑更昂贵的语义或全量压缩。并不是所有文本都值得调用模型概括。"),
  ]},
];

const application = (lesson: string, ...args: [id:string,kind:EngineeringQuestion["kind"],title:string,question:string,code:string,options:[string,string,string],correct:number,reasons:[string,string,string],explanation:string]) => {
  const l = LESSON_BY_ID[lesson];
  const [id,kind,title,question,code,options,correct,reasons,explanation] = args;
  return problem(id,[lesson,l.section,l.page],kind,title,question,code,options,correct,reasons,explanation);
};
const chapters: [number,string,EngineeringQuestion[]][] = [
  [1,"Agent 运行循环",[
    application("react","agent-observation","debug","运行轨迹","模型应基于工具刚返回的 working_dir 调整路径。当前循环为何仍使用旧路径？",`
messages = [{"role": "user", "text": "fix config"}]
tool_result = {"working_dir": "/srv", "error": "not_found"}
def decide(context):
    return "/srv/config" if any("/srv" in m["text"] for m in context) else "/app/config"
next_path = decide(messages)
print(next_path)
`,["把工具返回作为观察追加到 messages，再做下一次决策","只写入独立的工具日志，继续传同一 messages","仅追加 not_found 文本，working_dir 保存在独立日志"],0,
      ["上下文实际包含新观察，模型决策才有依据更新路径。","独立日志可用于审查，但 decide 本轮没有读取它。","错误进入上下文了，路径判断所需的 /srv 目录仍未进入。"],"ReAct 的闭环依赖执行结果进入后续决策。工具已经调用不等于模型已经看见它的反馈。"),
    application("agent","agent-capability","trace","动作空间","工具目录只有 read。代码中模型提出 write 后返回什么？这个结果反映了哪一层缺失？",`
tools = {"read": lambda path: "content"}
action = {"name": "write", "path": "/srv/config"}
handler = tools.get(action["name"])
result = "unsupported" if handler is None else handler(action["path"])
print(result)
`,["content；tools.get 会自动把未知名称回退为 read","unsupported；动作名称存在于决策，但执行能力未提供","KeyError；tools 没有 write，get 调用会直接抛异常"],1,
      ["get 没有传默认处理器，也不会按能力相似度自动回退。","工具定义决定实际动作空间，当前表没有 write。","dict.get 对缺失键返回默认的 None，与 tools[name] 的行为不同。"],"LLM、上下文与工具分别承担决策、观察和行动能力。诊断时需要找到缺失的实际接口，而不是只调整提示。"),
    application("harness","agent-runtime-boundary","tradeoff","运行时职责","执行器会接收多个模型的动作。要求权限规则对每个调用者都生效，该放在哪一层？",`
allowed_roots = {"/workspace"}
proposal = {"tool": "write", "root": "/archive"}
def execute(action):
    return "written"
result = execute(proposal)
print(result)
`,["只写进每个模型的 system prompt，由各模型自行执行","只在完成后的总结中检查，发现问题时减少评分","执行前在共享 Harness 校验 action，并把拒绝作为工具反馈"],2,
      ["提示是指导，多个调用者仍可能提出不合法动作。","事后发现无法撤销已发生的越界写入，不满足执行前边界。","统一门控覆盖实际调用路径，反馈还能进入下一次决策。"],"Harness 承担执行与控制边界。模型可提出方案，但不可绕过规则的要求需要落到执行路径。"),
  ]],
  [4,"工具接口实现",[
    application("fidelity","tool-normalization","debug","参数合同","接口文档承诺 limit 是返回条数，执行器却静默乘了 100。最小且可诊断的修复是什么？",`
request = {"query": "agent", "limit": 5}
def call_backend(args):
    return {"effective_limit": args["limit"] * 100}
result = call_backend(request)
print(request["limit"], result["effective_limit"])
`,["保持 limit 的合同；必要转换显式命名并报告有效参数","只在重试时减少 limit，保持当前接口定义不变","让模型在所有工具调用中先把 limit 除以 100"],0,
      ["模型感知的参数与实际执行可对应，问题可以从输入输出诊断。","只改变重试路径，没有修复首次调用的语义偏差。","把执行器内部的隐含换算泄露为调用者约定，其他工具也未必使用此单位。"],"参数保真不是禁止所有转换，而是不能让实际执行悄悄偏离模型所见的工具合同。"),
    application("discovery","tool-disclosure","trace","定义加载","目录已常驻 200 项元数据，但本轮只需 2 个工具。按代码，本轮载入多少个完整定义？",`
catalog = {"tool-" + str(i): "short metadata" for i in range(200)}
selected = ["tool-3", "tool-17"]
def load_definition(name):
    return {"name": name, "schema": "full schema"}
definitions = [load_definition(name) for name in selected]
print(len(catalog), len(definitions))
`,["200 200：有目录就已加载全部完整定义","200 2：目录负责发现，完整定义按需加载","2 2：未选工具的元数据会自动从 catalog 消失"],1,
      ["catalog 的值只是短元数据，完整 schema 来自独立加载过程。","代码只为 selected 的两项调用 load_definition。","selected 不会修改 catalog，未选工具仍可被发现。"],"工具索引与完整调用定义承担不同职责。渐进式披露减少常驻细节，同时保留发现其他能力的入口。"),
    application("aci","tool-result-schema","tradeoff","结果表示","定位工具故障需要区分超时与零结果。后端目前两者都返回空列表；怎样调整 ACI 更可诊断？",`
def search_backend(mode):
    return [] if mode in {"timeout", "no_matches"} else ["hit"]
observations = [search_backend(m) for m in ["timeout", "no_matches"]]
same = observations[0] == observations[1]
print(same)
`,["继续返回空列表，但在函数名中加入 reliable","把所有异常都转成字符串，成功结果也不再提供结构","结构化区分 status、items 和错误类别，说明重试边界"],2,
      ["命名不会补充被返回协议抹掉的状态差异。","有了文字却失去一致的可处理结构，仍难稳定区分结果类别。","不同故障返回可区分状态，调用者才能选择重试或继续检索。"],"Agent 友好的接口既描述输入，也提供足以决定下一步的输出与失败语义。"),
  ]],
  [5,"约束与恢复",[
    application("constraints","constraints-path","debug","目录边界","allowed 是唯一可写目录。当前检查把前缀相同的另一个目录也放行。哪个修复符合题设？",`
from pathlib import PurePosixPath
allowed = PurePosixPath("/work/app")
target = PurePosixPath("/work/application/config")
accepted = str(target).startswith(str(allowed))
same_tree = target == allowed or allowed in target.parents
print(accepted, same_tree)
`,["把 startswith 改为大小写无关的 startswith","规范化后按路径组成与父子关系判断，再在执行时约束","只在提示词里把 app 与 application 的区别说明得更清楚"],1,
      ["两者依然共享字符串前缀，大小写处理不解决目录边界。","本例已经表明两者没有父子关系；真实执行还要处理实际路径解析。","解释可帮助模型，但不能修复执行器的错误布尔判定。"],"可确定验证的规则应进入程序约束。本题用纯路径演示字符串前缀与目录关系不同，不将其声称为完整文件系统沙箱。"),
    application("recovery","recovery-classification","trace","错误分类","当前策略把哪一类失败视为可原样重试？",`
codes = [429, 400, 403]
def retryable(code):
    return code in {429, 503}
choices = [code for code in codes if retryable(code)]
print(choices)
`,["[429]：按题设只把限流归入当前可重试集合","[400, 403]：输入和权限问题先重试最节省成本","[429, 400, 403]：请求未成功就都满足重试条件"],0,
      ["当前集合只包含 429 和 503，输入中只有 429 匹配。","参数与权限条件不变时，原样重试不能改变失败原因。","是否成功与是否适合原样重试是不同的分类维度。"],"原书区分临时故障、参数错误和权限错误。这里的状态码集合是题设的策略示例，实际工具应提供明确类别。"),
    application("recovery","recovery-budget","tradeoff","重试预算","每次超时已消耗 4 秒，整个动作最多 10 秒。还要预留 2 秒返回失败结果，下一次重试前应该检查什么？",`
elapsed = 8
per_attempt = 4
budget = 10
response_reserve = 2
can_finish = elapsed + per_attempt + response_reserve <= budget
print(can_finish)
`,["仅检查尝试次数小于 3，时间预算交给外层处理","只降低下一次请求温度，维持同样超时设置","检查剩余时间与尝试可恢复性，不够则返回明确失败"],2,
      ["次数上限可能允许总时长越界，不能代替本题明确的时间预算。","模型采样设置不会缩短执行器已经配置的超时时长。","还需 6 秒而只剩 2 秒，不应再开始无法在预算内完成的原样尝试。"],"可恢复性、次数和时间是不同的恢复边界。有限预算下，停止并暴露真实失败比越界重试更可控。"),
  ]],
  [6,"事件与隔离",[
    application("events","events-order","debug","事件消费","队列是按到达时间排列的。取消操作必须在创建操作之后处理，当前循环为什么先处理了 cancel？",`
queue = [{"type": "create", "seq": 1}, {"type": "cancel", "seq": 2}]
trajectory = []
while queue:
    event = queue.pop()
    trajectory.append(event["type"])
print(trajectory)
`,["交换 seq 字段的数值，保持 pop() 不变","消费队首并保留顺序，再把事件追加进轨迹","把两条事件的类型合成一个提示词交给模型排序"],1,
      ["pop() 仍然先取列表末尾，修改编号不会改变消费顺序。","在题设的到达顺序要求下，队首消费对应 FIFO。","把执行时序交给模型猜测，不保证运行时维护的顺序约定。"],"事件驱动 Agent 需要由运行时管理队列、轨迹和决策时序。收到事件并不自动等于以正确顺序处理事件。"),
    application("isolation","isolation-scopes","trace","权限集合","Agent 身份只有 read，提议动作要求 read 和 write。按代码是否允许执行？",`
identity_scopes = {"read"}
required = {"read", "write"}
has_any = bool(identity_scopes & required)
has_all = required <= identity_scopes
print(has_any, has_all)
`,["True True：有一个权限就覆盖动作全部需求","False False：独立身份默认不能读取任何内容","True False：有交集，但没有动作要求的全部权限"],2,
      ["交集非空只证明有至少一个权限，不证明包含所有需求。","题设明确赋予 read，并不是空权限集合。","需要把全部 required 作为约束，不能误用 has_any 放行。"],"独立身份限制影响范围，但执行器仍需正确解释动作所需的权限集合。"),
    application("isolation","isolation-auth-state","tradeoff","认证状态移交","自动化需要用户完成可视登录。如何既等待认证完成，又避免把敏感凭据文本放进模型上下文？",`
session = {"authenticated": False, "credential": "hidden"}
def visible_login():
    session["authenticated"] = True
visible_login()
observation = {"authenticated": session["authenticated"]}
print(observation)
`,["由可视环境完成登录，运行时回传认证状态与必要操作结果","把完整 session 包括 credential 序列化到每轮上下文","让模型将登录页文本当成认证已成功的唯一证据"],0,
      ["回传运行时观察到的状态，不要求模型持有凭据内容。","给模型暴露凭据并不是完成认证后动作所必需的信息。","登录页出现不证明认证完成，还需要实际状态或执行反馈。"],"原书将需要用户认证的操作保留在用户可见环境。运行时可以提供状态观察，而无需将敏感认证材料当作普通任务上下文。"),
  ]],
  [7,"可重复评估",[
    application("pass","eval-probabilities","trace","两种成功口径","独立同分布、单次成功率为 0.6。下面两行分别对应什么指标？",`
p = 0.6
k = 5
at_least_one = 1 - (1 - p) ** k
all_runs = p ** k
print(round(at_least_one, 3), round(all_runs, 3))
`,["0.99 是 Pass^5；0.078 是 Pass@5","0.99 是 Pass@5；0.078 是 Pass^5","两者都估计单次成功率，只是舍入精度不同"],1,
      ["把至少一次与全部成功的指标方向反了。","前者在五次中至少成功一次，后者要求五次连续全部成功。","重复运行的事件定义不同，不能当作对同一单次指标的舍入。"],"能力上限与稳定可靠性需要区分。计算式依赖题设中的独立同分布假设，不能直接外推到强相关的重复运行。"),
    application("evaluation","eval-reset-state","debug","初始状态","B 在 A 修改后的环境里评估，结果不能直接比较。最小实验修复是什么？",`
state = {"remaining": 2}
def run(version):
    state["remaining"] -= 1
    return version, state["remaining"]
print(run("A"))
print(run("B"))
`,["只把运行顺序换成 B、A，保留同一个可变环境","增大样本数量，但每次继续沿用上一次末态","每个版本从同一初始状态重置，再按相同协议评估"],2,
      ["只是把优势换给另一个版本，仍然没有控制初始条件。","数据量增加不能自动消除由可变初始状态造成的混杂。","隔离每次运行的初始条件，才能让结果具有可比较性。"],"可重置状态、工具、任务与评分协议共同构成评估环境。版本比较需要先排除环境前后状态的差异。"),
    application("ablation","eval-ablation","tradeoff","模块归因","新版同时换了模型和检索器，分数升高。预算只够增加一组对照，若当前目标是衡量新版检索器的贡献，该如何选？",`
baseline = {"model": "M1", "retriever": "R1", "score": 60}
candidate = {"model": "M2", "retriever": "R2", "score": 75}
same_tasks = True
same_budget = True
print(candidate["score"] - baseline["score"])
`,["用 M2+R1，在相同任务、种子与预算下和 M2+R2 比较","再跑一次 M1+R1，只比较两次最高分","用 M3+R2，只要保留 R2 就能排除模型因素"],0,
      ["固定模型为 M2，只改变检索器，符合本轮的归因目标。","可估计一部分波动，但不能拆开模型与检索器同时变化的贡献。","又改变了模型，引入新的混杂变量。"],"一次验证一个具体改动。提高 15 分是观测结果，并不自动说明其中多少由检索器贡献。"),
  ]],
  [8,"训练与奖励",[
    application("sft","training-objective","trace","训练目标","哪个数是当前代码累加的示范负对数似然？",`
from math import log
demo_probabilities = [0.5, 0.25]
nll = -sum(log(p) for p in demo_probabilities)
rewards = [1, 0]
mean_reward = sum(rewards) / len(rewards)
print(round(nll, 3), mean_reward)
`,["0.5；SFT 与 RL 都直接平均终点奖励","2.079；它与 0.5 的平均奖励是不同优化量","2.079；因此示范任务以外也必然成功"],1,
      ["0.5 来自 rewards，不是对示范概率取对数累加的结果。","两组数据对应不同目标，不能仅因都用于训练就互换。","目标计算正确不意味着无条件获得任务外泛化。"],"SFT 的示范似然与 RL 的期望奖励需要分别理解。泛化还受数据、环境和底座能力影响。"),
    application("support","training-zero-signal","debug","奖励差异","本题用减去组内均值的相对奖励作为信号。所有 rollout 都失败时，仅重复这一批数据能提供什么信号？",`
rewards = [0.0, 0.0, 0.0, 0.0]
mean = sum(rewards) / len(rewards)
advantages = [r - mean for r in rewards]
nonzero = sum(a != 0 for a in advantages)
print(advantages, nonzero)
`,["四条正信号，只要增加更新次数就能覆盖缺失技能","四条负信号，应直接删除失败任务","零差异信号；先诊断能力、接口或课程可达性"],2,
      ["减去同样的均值仍然为零，重复次数不会创造本例不存在的差异。","删除难题能让指标看起来更好，却不补齐成功行为或反馈。","先让环境、示范或课程产生可达的有效反馈，再检验训练收益。"],"稀疏奖励不能被当作自动创造任意能力的保证。本例的计算仅说明当前这组相对奖励信号为零，不涵盖所有 RL 算法。"),
    application("reward","training-path-result","tradeoff","结果与路径","评分器只看测试全绿，候选删除了失败测试。怎样修复验收以区分真正修复与绕过检查？",`
original_tests = {"a", "b", "c"}
submitted_tests = {"a", "b"}
all_remaining_pass = True
score = int(all_remaining_pass)
print(score, original_tests - submitted_tests)
`,["独立检查交付与原验收集合，并对违规路径设置约束","只将全绿分数乘以原来测试数量，保留当前评分输入","要求作者写出更详细的成功解释，仍不检查测试集合"],0,
      ["对完整验收集合与行为路径分别检查，才能识别被删掉的失败条件。","改变分值大小不补充缺失的原验收信息。","作者说明依然来自候选本身，不能代替独立验证。"],"最终成功和路径约束是两个验证维度。结果奖励与确定性行为检查应配合，而不是仅奖励一个可被篡改的表面信号。"),
  ]],
  [9,"持续进化",[
    application("evolution","evolution-carrier","tradeoff","经验载体","一条目录权限规则已稳定、可执行验证，所有工具调用都必须遵守。哪种经验载体更符合这个需求？",`
rule = {"root": "/workspace", "mandatory": True}
proposed_action = {"root": "/archive"}
def policy(action):
    return action["root"] == rule["root"]
print(policy(proposed_action))
`,["把规则增加为一条检索记忆，依赖每次召回","将规则接入 Harness 的共享执行门控并回归验证","仅增加相似示范，让模型在生成时尽量模仿"],1,
      ["按需检索可能漏召回，不适合承担每次都必须执行的确定性约束。","与需求的稳定、确定、不可绕过性质对应，且可以直接验证。","示范能指导行为，但不能保证每一条执行路径都被约束。"],"原书区分知识库、Prompt/Skill、程序/Harness 和模型参数。载体选择要根据经验性质及验收要求，而不把所有经验都追加到记忆库。"),
    application("retention","evolution-holdout","trace","更新与保持","新版本修复 A。若评估器只上报目标 A，下面的保留集还暴露了什么？",`
old = {"A": False, "B": True, "C": True}
new = {"A": True, "B": False, "C": False}
fixed = [k for k in old if not old[k] and new[k]]
regressed = [k for k in old if old[k] and not new[k]]
print(fixed, regressed)
`,["能；只要目标 A 成功，旧任务不属于本次更新","能；修复数与回归数都是非零，说明在持续学习","不能；已发生两项保持性退化，还需迁移与成本验证"],2,
      ["目标修复不替代已有能力保持，不能仅以单点收益宣称总体成功。","非零变化本身不是进步方向，代码暴露了两项回归。","修复 A 与回归 B、C 都是真实结果，应一起进入更新验收。"],"持续进化需要更新、迁移与保持。局部问题解决之后仍需验证旧能力和边界，而不是把所有行为变化都解释为进步。"),
    application("sleep","evolution-offline-publish","debug","候选发布","离线整理先发布候选再评估，失败后保留哪个版本？怎样调整才能支持验证与回滚？",`
active = "v1"
candidate = "v2"
active = candidate
checks_passed = False
published = active
print(published, checks_passed)
`,["先验证候选，成功再切换 active，并保留 v1 的证据与版本","只给 v2 增加更长的经验文本，不调整发布顺序","把 v1 文件名改成 v2，使回滚不需要维护版本"],0,
      ["把经验整理与发布解耦，失败不必覆盖当前可用版本。","内容长度不解决失败候选已经成为 active 的发布时序问题。","改名会抹去可区分的版本身份，不是保留可回退状态。"],"离线整合要处理冲突、来源和版本，再验证更新收益。采集经验、生成候选、验收和发布应具有明确边界。"),
  ]],
  [10,"多 Agent 协作",[
    application("collaboration","collaboration-evidence","tradeoff","审查信息来源","三个审查角色读同一份成功说明，都投了赞成票。若预算只够一个额外动作，什么更能检验测试是否真通过？",`
report = "tests passed"
votes = [report == "tests passed"] * 3
tool_exit_code = 1
approved = all(votes)
print(approved, tool_exit_code)
`,["增加第四个角色，同样只阅读原成功说明","让三个角色交换措辞，再统计赞成比例","读取真实测试输出与产物，定位 exit_code=1 的原因"],2,
      ["继续复用同一份输入，角色数量增加并未引入新的验证证据。","讨论可以改善理解，但不能代替缺失的执行结果检查。","外部执行反馈与成功说明矛盾，能改变当前判断。"],"多 Agent 的价值取决于信息增量。角色数量和一致投票不能自动取代工具、测试与真实产物的证据。"),
    application("reviewer","reviewer-independence","trace","独立验收","作者宣称完成，审查器按独立测试退出码判断。最终结果是什么？",`
author_says_done = True
exit_code = 1
artifact_exists = True
accepted = exit_code == 0 and artifact_exists
print(author_says_done, accepted)
`,["True False：完成声明与验收结果不同","True True：存在产物即可覆盖失败测试","False False：审查失败会改写作者原来的声明"],0,
      ["作者声明不参与 accepted 的计算，失败退出码导致验收不通过。","产物存在只满足一个条件，不能把 and 当作 or。","验收布尔值不会反向修改 author_says_done。"],"独立审查依据任务要求和可验证结果。作者自述与外部验收应作为不同来源的信息保留。"),
    application("handoff","handoff-contract","debug","移交载荷","接手者要在 EU 部署，且不得超过预算 50。当前移交只有目标与日志路径，怎样补齐可验收的执行边界？",`
task = {"goal": "deploy", "region": "EU", "budget": 50}
handoff = {"goal": task["goal"], "log": "run-17.log"}
required = {"goal", "region", "budget"}
missing = required - handoff.keys()
print(sorted(missing))
`,["把日志全文全部放入 handoff，依靠接手者自己找限制","显式移交目标、必要约束、证据与验收标准，并维护控制边界","只补一个 expected_answer 字段，避免接手者改变策略"],1,
      ["大量历史不保证必要限制被清楚传达，还会带来冗余上下文。","载荷直接表达任务需要的约束，接手者与运行时才有可检查的合同。","最终答案模板没有补回 region 和 budget 两个执行边界。"],"有界移交需要足以支持决策和验收的必要信息，同时由运行时维护控制权。答案移交与任务执行边界不是同一件事。"),
  ]],
];
const extra: Record<number, EngineeringQuestion[]> = {
  1:[
    application("react","agent-stop","debug","结束条件","执行器返回 done=False，最终状态却被设为成功。下面哪个改动能让停止条件与执行反馈对应？",`
tool = {"ok": True, "done": False, "next": "verify"}
state = "running"
if tool["ok"]:
    state = "success"
print(state, tool["next"])
`,["保持 ok 为结束条件，next 仅写入日志","依据 done 与验收证据决定完成，ok 只表示调用成功","只检查 next 是否非空，非空就表示任务已完成"],1,["调用成功不等于目标已完成，当前还要求 verify。","把工具调用状态与任务状态分开，才能继续必要的验证。","这里 next=verify 恰好说明还有后续动作。"],"运行循环需要可观察的完成条件。工具执行没有报错，并不自动构成任务成功的证据。"),
    application("agent","agent-context-view","trace","可见输入","模型调用只收到 messages。磁盘里的规则没有被读取时，下面 available 的值是什么？",`
disk = {"rules.txt": "deploy only to EU"}
messages = ["deploy service"]
available = any("EU" in text for text in messages)
on_disk = "rules.txt" in disk
print(available, on_disk)
`,["False True：文件存在与进入上下文是两种状态","True True：模型可以按文件名推断完整规则","False False：未加载的文件就不会存在于磁盘"],0,["调用参数没有 EU；文件仍在，但没有成为本次观察。","工具和加载动作没有发生，文件名不能提供具体规则。","是否加载与文件是否存在是独立条件。"],"上下文定义当前决策所能感知的信息。排障时要检查实际调用输入，而不是只检查资料存不存在。"),
    application("harness","agent-tool-failure","tradeoff","失败反馈","执行器把超时和权限拒绝都折叠为 False，模型总用同一种恢复方案。怎样改运行时反馈最有助于分流？",`
errors = ["timeout", "permission_denied"]
observations = [False for _ in errors]
distinct = len(set(observations))
print(distinct, len(errors))
`,["保留 False，仅在最终总结增加失败次数","把所有错误改成固定文本 retry，降低解析复杂度","返回可区分的错误类别与上下文，让下一次决策选择恢复路径"],2,["失败次数不能恢复被折叠掉的错误类别。","所有情况仍被映射为同一观察，甚至隐含了不适用的重试建议。","运行时向模型提供足以区分恢复条件的观察。"],"Harness 与决策循环需要共享可解释的执行反馈。错误类别被抹掉时，模型无法仅靠相同 False 判断应修权限还是重试。"),
  ],
  4:[
    application("mcp","tool-protocol-kinds","trace","协议能力","路由只允许对 tool 执行动作。resource=policy 读出来的文字应被当成什么？",`
entries = {"search": {"kind": "tool"}, "policy": {"kind": "resource"}}
def executable(name):
    return entries[name]["kind"] == "tool"
print(executable("search"), executable("policy"))
`,["True True：接入相同协议就具有相同执行权限","False True：resource 比 tool 更适合作为运行命令","True False：资源可提供数据，但不因此成为可执行操作"],2,["协议入口统一不表示能力类型和执行权限相同。","资源语义并不是运行命令，执行器的判断方向也相反。","tools 与 resources 在协议中有不同职责。"],"MCP 组织工具、只读资源和提示模板，接入协议不等于所有返回文本都具有执行授权。"),
    application("aci","tool-structured-errors","debug","返回值歧义","执行器用空字符串同时表示无匹配与失败。哪种协议改动能让调用者区分两者，同时保留结构化结果？",`
def search(mode):
    if mode == "timeout":
        return ""
    return ""
print(search("timeout") == search("empty"))
`,["将结果改成 status+items+error 字段，并定义每种状态","将空字符串换成 None，两种情况仍共用同一值","通过工具名称区分搜索器，返回结构保持不变"],0,["显式状态保留了区分下一步动作所需的信息。","只是换了一个共同的空值，歧义依然存在。","名称可区分工具，不区分同一工具本次运行的结果类别。"],"好的 ACI 需要让模型能从结果决定下一步。成功无数据和调用失败不应在返回表示上无法区分。"),
    application("discovery","tool-stale-definition","tradeoff","目录与细则","目录中有 upload，但当前完整定义 v2 增加了必填 workspace。发现工具后应如何准备调用？",`
catalog = {"upload": "store a file"}
schema = {"version": 2, "required": ["path", "workspace"]}
args = {"path": "report.txt"}
missing = set(schema["required"]) - args.keys()
print(sorted(missing))
`,["只依据目录描述调用，让执行器自动猜 workspace","加载当前完整定义并补齐参数，再执行调用","把工具名称追加到上下文，就等同于取得完整 schema"],1,["目录为发现而设，不能替代当前参数合同；猜测可能选错工作区。","发现之后仍需读取当前定义，才能满足实际必填条件。","名称不包含版本或参数细则，缺失字段仍是 workspace。"],"分层披露在降低常驻成本的同时，要求调用前按需获取完整细则。目录与可执行定义不是同一层内容。"),
  ],
  5:[
    application("constraints","constraints-validation-order","trace","校验顺序","日志中的 write 在 reject 之前出现。当前执行顺序是否满足禁止越权写入？",`
events = []
allowed = False
events.append("write")
if not allowed:
    events.append("reject")
print(events)
`,["满足，返回 reject 就会撤销此前写入","不满足，门控必须发生在有副作用动作之前","满足，只要模型最终读到 reject 即可"],1,["普通的拒绝返回不自动回滚已发生的副作用。","检查发生太晚，只能报告违规而不能防止它。","模型后续看到失败不会改变此前执行顺序。"],"不可绕过的规则需要落实为动作之前的程序门控，而不仅是动作之后的文字提示。"),
    application("recovery","recovery-input-change","debug","重试是否有变化","工具一直报 missing workspace，重试只改变了 request_id。下一次请求应优先修改什么？",`
args = {"path": "report.txt", "request_id": 1}
def validate(a):
    return "ok" if "workspace" in a else "missing workspace"
args["request_id"] += 1
print(validate(args))
`,["继续增加 request_id，以保证每次都是新尝试","延长超时，给服务端更多时间推断 workspace","根据工具定义提供正确 workspace，或报告缺少必要输入"],2,["请求身份改变了，缺少的业务参数没有改变。","缺字段是输入合同问题，等待时间不会补齐参数。","恢复必须改变导致失败的条件，不能只改变尝试的外观。"],"分类恢复要识别输入错误与临时故障的差别。表面上换了请求，并不代表对失败原因做了修正。"),
    application("constraints","constraints-test-signal","tradeoff","反馈接入","Agent 修改后继续下一步前需要知道检查器结果。当前只把退出码写在独立日志，决策上下文仍显示旧成功。哪种连接方式更可靠？",`
checker_exit = 1
disk_log = [checker_exit]
context = ["previous check passed"]
visible_failure = any("failed" in text for text in context)
print(visible_failure, disk_log[-1])
`,["把实际检查结果加入后续观察，未通过时保持执行门控","只保留磁盘日志，假定模型会自动读取最新文件","用较新的时间戳替代旧成功信息，不加入检查结果"],0,["运行约束和可见反馈对齐，Agent 才能根据失败纠正行动。","存盘不等于已进入本次调用，模型未必有读取这份日志。","时间信息不能替代成功或失败这一执行事实。"],"快速反馈要真正进入执行循环。运行时检查、状态门控和模型所见的观察应能相互对应。"),
  ],
  6:[
    application("events","events-payload","debug","事件内容保留","队列只保存了类型，不保存文档标识。两个更新通知进入决策时无法区分，该如何修正入队数据？",`
incoming = [{"type": "changed", "doc": "A"}, {"type": "changed", "doc": "B"}]
queue = [event["type"] for event in incoming]
unique = len(set(queue))
print(unique, len(incoming))
`,["保留事件身份、对象与必要载荷，再按顺序纳入轨迹","把 changed 改名为 update，继续不存文档字段","把两条相同类型事件合并，只处理一次以减轻负载"],0,["对象和内容是区分外部变化所需的证据。","同义的类型名仍然不能区分文档 A 与 B。","类型相同不代表同一事件，合并会漏掉一个文档更新。"],"事件队列需要保存后续决策真正需要的观察，不能在入队时丢掉关键实体信息。"),
    application("isolation","isolation-shared-state","trace","环境隔离","两个身份仍共用同一个状态字典，A 的写入会让 B 看见什么？",`
shared = {"token": None}
a = shared
b = shared
a["token"] = "a-session"
print(b["token"], a is b)
`,["None False：身份名称不同就自动复制了存储","a-session True：身份名不同但仍共享同一状态对象","None True：共享对象只共享结构，不共享字段值"],1,["赋值引用没有复制字典，身份名称本身也不是存储隔离。","A 和 B 指向同一对象，写入会相互可见。","共享同一对象时，字段内容也被共享。"],"独立身份与环境隔离需要落实到实际存储与执行边界，而不能仅给相同资源起不同角色名称。"),
    application("events","events-observation-before-decision","tradeoff","观察顺序","新事件已经入队，模型却在事件进入轨迹前决策。想让本轮决策考虑新截止时间，应该调整哪一步？",`
trajectory = ["deadline=Friday"]
queue = ["deadline=Thursday"]
decision_view = list(trajectory)
trajectory.extend(queue)
print(decision_view[-1], trajectory[-1])
`,["仅给 queue 中事件添加时间戳，保持决策输入不变","把模型回答写回 queue，下一轮仍使用旧 trajectory","先将新事件纳入本轮可见观察，再创建决策输入"],2,["有时间戳但不进入决策输入，模型仍看不到新截止日。","回答不是缺失的新事件观察，无法修正本轮输入的时间差。","决策应基于当时可用的最新事件，输入快照要在纳入事件之后创建。"],"运行时管理观察与动作的时序。事件已被接收与事件已被本轮模型看见，仍是两个不同的状态。"),
  ],
  7:[
    application("evaluation","eval-hidden-state","debug","隐藏状态","每个任务都要求从干净工具环境开始。下面仅重置任务名，cache 却保留。哪个修改能落实可重复初始条件？",`
cache = {"answer": "from task-A"}
task_name = "task-A"
task_name = "task-B"
reused = cache.get("answer")
print(task_name, reused)
`,["只固定 task_name 的随机种子","在每个任务开始重置题设要求的环境状态与缓存","对不同任务的最终得分取平均即可消除缓存影响"],1,["任务标签或种子不负责清空工具内部状态。","明确初始状态协议，并重置实际会影响执行的状态。","平均分不能撤销前一任务状态泄露对后一任务的影响。"],"评估环境不仅包含题目文本，也包含工具与可变状态。要按协议控制这些条件，才有可靠比较。"),
    application("pass","eval-correlated-runs","tradeoff","指标假设","五次运行复用了同一条缓存轨迹。是否可以直接用 p^5 表示五次全成功概率？",`
cached_success = True
runs = [cached_success] * 5
same_source = len({id(r) for r in runs})
print(all(runs), same_source)
`,["可以，列表里有五个元素就意味着五次独立采样","可以，只要把列表再洗牌一次就满足独立性","不能据此套用独立公式；应先定义并验证重复运行协议"],2,["元素个数不证明采样事件独立，缓存结果可以完全相关。","打乱相同结果不产生新的独立执行证据。","p^k 的推导有独立同分布条件，复用同一轨迹不满足这种证据要求。"],"重复运行次数与独立采样条件需要分别定义，不能把缓存复制的观测当作五次独立可靠性测试。"),
    application("ablation","eval-budget-confound","trace","成本混杂","B 的成功率更高，但调用预算也是两倍。当前结果直接支持哪种结论？",`
results = {"A": {"success": 6, "tasks": 10, "calls": 20},
           "B": {"success": 8, "tasks": 10, "calls": 40}}
gain = results["B"]["success"] - results["A"]["success"]
call_ratio = results["B"]["calls"] / results["A"]["calls"]
print(gain, call_ratio)
`,["观察到多成功 2 项且调用翻倍，还不能单独归因于某个模块","只要任务数相同，就能宣布 B 的模块质量必然更高","调用翻倍意味着两组任务分布一定不同"],0,["这是可直接核对的结果，同时暴露了预算不等这一混杂因素。","任务数相同不等于预算相同，也不能拆开多因素变化的贡献。","调用差异不证明任务分布发生了变化，题设没有提供这种证据。"],"评估需要把能力、可靠性与成本一起报告，并控制对照条件。观测增益与因果归因是不同层次的结论。"),
  ],
  8:[
    application("reward","training-reward-shape","debug","奖励输入","评分器只检查输出中含 PASS，即使真实检查失败也给分。应该用哪个信号替代字符串命中？",`
response = "PASS: fixed"
tool_exit = 1
reward = int("PASS" in response)
print(reward, tool_exit)
`,["增加 PASS 关键词的权重","独立执行结果与交付验收，并对违规路径另行检查","要求模型只输出 JSON 中的 pass=true"],1,["加权会放大当前错误代理信号，而不是增加真实验证。","让奖励依赖外部可验证目标，避免只奖励自述。","结构化自述仍然是自述，不能替代实际执行结果。"],"奖励器需要检查真正目标，而不仅是候选容易操纵的表面表示。结果验证也不能替代过程边界。"),
    application("sft","training-demo-scope","trace","示范与新任务","训练示范上全成功，新任务一半失败。代码展示了什么，而没有证明什么？",`
demo = [True, True, True, True]
held_out = [True, False, True, False]
train_rate = sum(demo) / len(demo)
new_rate = sum(held_out) / len(held_out)
print(train_rate, new_rate)
`,["1.0 0.5：示范拟合与独立任务表现存在差异","1.0 1.0：训练成功率会自动替代新任务分数","0.5 1.0：独立任务应被并入示范后重新命名指标"],0,["数据分别给出两个指标，独立任务成功率不能由示范拟合代替。","没有计算依据将两条失败改为成功。","交换名称或混合数据不能解释新任务的实际表现。"],"SFT 或 RL 的名称本身不保证泛化。需要独立任务证据，并说明数据与训练条件。"),
    application("support","training-curriculum","tradeoff","可达课程","工具 schema 无效导致所有 rollout 在执行前失败。训练前应如何区分接口问题与策略能力不足？",`
rollouts = [{"stage": "parse", "ok": False} for _ in range(4)]
executed = [r for r in rollouts if r["stage"] == "execute"]
rewards = [0 for _ in rollouts]
print(len(executed), sum(rewards))
`,["先增加同一无效 schema 下的 rollout 数量","把 parse 失败也设为正奖励以增加信号差异","先修复接口可执行性并验证任务可达，再判断策略训练需求"],2,["更多相同的接口失败不提供成功执行的行为证据。","人为奖励解析失败会改变目标，并不使任务变得可执行。","先定位失败层次，避免把运行条件缺陷误判为模型不能学习策略。"],"全零奖励可能来自接口、能力或课程问题，需要根据轨迹定位。对底座进行训练之前应先确认环境实际可执行。"),
  ],
  9:[
    application("retention","evolution-transfer-gap","debug","迁移验证","新 Skill 把示范路径写死，原样复测通过，换路径就失败。怎样验收才能发现这种局部记忆？",`
skill_path = "/demo/config"
def solve(path):
    return path == skill_path
print(solve("/demo/config"), solve("/project/config"))
`,["扩大示范的重复次数，继续只测 /demo/config","增加保持集与变体迁移集，核对规则是否依赖无关路径","把所有测试路径都重命名成示范路径"],1,["重复同一个路径不会暴露迁移时的固定值依赖。","在可控变体上检验同一原则，才能区分可迁移规则与样例记忆。","改测试迎合实现会掩盖泛化问题，而不是解决它。"],"进化要检验迁移与保持，不仅是重复原来的成功情境。测试应保留目标能力的真实要求。"),
    application("sleep","evolution-source-retention","trace","经验来源","两条经验经过同文本去重后，只留下一个 source。以后审查另一条轨迹时缺失了什么？",`
notes = [{"rule": "check result", "source": "run-A"},
         {"rule": "check result", "source": "run-B"}]
merged = {n["rule"]: n for n in notes}
print(len(merged), next(iter(merged.values()))["source"])
`,["规则被去重，但来源 A 被覆盖，应合并来源集合而非只覆盖条目","两条来源都保留了，因为字典键相同会自动合并字段","规则无法复用，因为所有相同文本都必须保留两份"],0,["合并重复经验可以保留一个规则表示，同时累计多个证据来源。","字典赋值覆盖同键的值，不会自动合并 source。","规则复用与证据保留可以分开实现，不必保留重复正文。"],"离线整合需要在去重和保留来源之间做明确设计，不能把减少条目等同于允许丢掉验证依据。"),
    application("evolution","evolution-retrieval-loop","tradeoff","经验进入决策","经验库已经保存修复规则，但决策函数从未读取。要判断保存是否带来收益，下一步怎样构造闭环？",`
memory = ["verify after write"]
context = ["edit config"]
decision_input = list(context)
loaded = any(rule in decision_input for rule in memory)
print(loaded)
`,["增加记忆条目数量，继续保持当前决策输入","仅把成功复盘写得更长，依靠未来自动生效","在相关任务中取回或程序化应用规则，再独立比较结果"],2,["存储容量增加不改变决策函数没有加载记忆的事实。","复盘文本未接入决策或执行，不能据此推断行为收益。","经验需要影响后续行为，并通过评估检验是否有效。"],"保存经验是持续进化的一环，不是闭环终点。应区分经验被写下、被取回、被执行和带来可验证收益。"),
  ],
  10:[
    application("handoff","handoff-control","debug","控制权边界","运行时约定只有 coordinator 可以提交。worker 拿到任务文本后却直接提交，哪个检查应进入执行器？",`
actor = "worker"
allowed_submitters = {"coordinator"}
can_submit = actor in allowed_submitters
submitted = True
print(can_submit, submitted)
`,["在任务文本中再次强调 coordinator 的称谓","将 worker 的总结改为 coordinator-approved 字符串","提交前校验实际调用身份与权限，未通过则拒绝"],2,["称谓提醒不是执行器中的控制权约束。","文案可以被复制，不能证明实际身份获得了提交权。","由运行时验证实际身份，才能落实明确的控制边界。"],"有界移交不仅是传递上下文，还需要运行时维护控制权与授权范围。"),
    application("collaboration","collaboration-stale-artifact","trace","产物版本","审查者测试的是 v1，作者随后交付 v2。当前验收证据是否覆盖交付内容？",`
tested_version = "v1"
delivered_version = "v2"
test_passed = True
covered = test_passed and tested_version == delivered_version
print(test_passed, covered)
`,["True False：测试通过，但证据没有对应到交付版本","True True：只要审查者独立，就能覆盖之后所有改动","False False：版本不一致会使之前测试从未发生"],0,["执行结果仍是真实的，但它支持的是 v1 而非 v2。","独立角色不能使旧执行结果自动适用于新产物。","旧测试确实发生过，只是适用范围不同。"],"协作需要真实信息增量，还要把证据绑定到实际被检查的产物。版本不对应时，成功结论不能直接移植。"),
    application("reviewer","reviewer-check-selection","tradeoff","审查范围","审查任务是验证改动修复了失败路径。作者只提供变更清单，预算允许重跑一项相关检查。哪种行动更有验证价值？",`
changed_files = ["parser.py"]
old_failure = "empty-input"
author_note = "fixed"
executed_checks = []
print(len(changed_files), len(executed_checks))
`,["统计改动行数，行数越多越能说明问题已解决","运行 empty-input 回归并检查实际输出与交付要求","让另一个角色重述作者说明，增加意见独立性"],1,["改动量证明发生了编辑，不证明目标失败路径的行为已改善。","相关执行结果直接检验本次审查需要验证的行为。","换一个说话者重复同一信息，并没有补充真实执行证据。"],"审查应围绕待证实的任务行为选择检查，而不是把角色数量或修改清单当作成功证据。"),
  ],
};
for (const [chapter,title,questions] of chapters)
  ENGINEERING_TRIALS.push({id:`engineering-${chapter}`,topic:"engineering",title:`第 ${chapter} 章 · ${title}`,questions:[...questions,...extra[chapter]]});
