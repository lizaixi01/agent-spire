import "./style.css";
import "./pixel.css";
import {
  CARDS,
  CARD_BY_ID,
  CHARACTERS,
  RELICS,
  cardText,
  statsFor,
  isCardForCharacter,
  canAcquireCard,
  isRelicForCharacter,
  type Card,
  type CharacterId,
} from "./cards";
import {
  CHAPTERS,
  CHAPTER_BOSSES,
  LESSONS,
  LESSON_BY_ID,
  SOURCE,
  actLessons,
  sourceLabel,
} from "./content";
import {
  createRun,
  availableNodes,
  enterNode,
  playCard,
  endTurn,
  enemyIntent,
  usePotion,
  answerLab,
  combatUnlocked,
  useReset,
  burstBonus,
  takeBossBait,
  chooseReward,
  answerQuiz,
  finishQuiz,
  rest,
  buy,
  leaveRoom,
  claimTreasure,
  resolveEvent,
  type Run,
  type RoomKind,
} from "./engine";
import { decodeRun, encodeRun } from "./save";
import { icon } from "./icons";
import { heroArt, enemyArt } from "./art";
import { cardIllustration } from "./card-art";
import { GameAudio, audioSettings } from "./audio";
import { combatFeedback } from "./combat-feedback";
import { capturePositions, showCombatEffects, showTrialCelebration } from "./visual-effects";
import { TRIAL_BY_ID, trialQuestion, trialQuestionAt, trialScore } from "./trials";
import { caseForBattle, transferFor } from "./learning-cases";
import { synergyFor } from "./synergy";
import { impactFor } from "./impact";
import { installCardDrag } from "./card-input";
import { MODELS, modelForCharacter, modelSprite, modelLogo } from "./models";
import { BOSS_RULES, bossStatus } from "./boss-mechanics";
import { eventView, eventRelicLabel } from "./chapter-events";
import { caseHint } from "./learning-hints";

const app = document.querySelector<HTMLDivElement>("#app")!;
const SAVE_KEY = "agent-spire.run.v1";
const PROFILE_KEY = "agent-spire.knowledge.v1";
interface Profile {
  learned: string[];
  mastery: Record<string, number>;
  victories: number;
  completedSeeds: number[];
}
let storageAvailable = true;
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    storageAvailable = false;
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    storageAvailable = false;
  }
}
function loadProfile(): Profile {
  try {
    const v: unknown = JSON.parse(read(PROFILE_KEY) ?? "null");
    if (typeof v !== "object" || v === null) throw new Error("empty");
    const p = v as Partial<Profile>;
    return {
      learned: Array.isArray(p.learned)
        ? p.learned.filter(
            (id) => typeof id === "string" && Object.hasOwn(LESSON_BY_ID, id),
          )
        : [],
      mastery:
        p.mastery && typeof p.mastery === "object"
          ? Object.fromEntries(
              Object.entries(p.mastery).filter(
                ([id, n]) =>
                  Object.hasOwn(LESSON_BY_ID, id) &&
                  Number.isInteger(n) &&
                  n >= 0 &&
                  n <= 3,
              ),
            )
          : {},
      victories:
        Number.isInteger(p.victories) && p.victories! >= 0 ? p.victories! : 0,
      completedSeeds: Array.isArray(p.completedSeeds)
        ? p.completedSeeds.filter(Number.isSafeInteger)
        : [],
    };
  } catch {
    return { learned: [], mastery: {}, victories: 0, completedSeeds: [] };
  }
}
const saved = read(SAVE_KEY);
let run: Run | null = saved ? decodeRun(saved) : null;
let profile = loadProfile();
let view: "home" | "game" | "codex" = "home";
let selectedChar: CharacterId = "scholar";
let activeLessonId: string | null = null;
let labExpanded = innerWidth >= 1100;
let labHintVisible = false;
let presentationTimer: number | undefined;
let seedDraft = "";
let modal:
  | "help"
  | "deck"
  | "characters"
  | "settings"
  | "draw"
  | "discard"
  | "exhaust"
  | "upgrade"
  | "remove"
  | "lesson"
  | "practice"
  | null = null;
let selectedLesson = LESSONS[0].id;
let practiceAnswer: number | null = null;
let chapterFilter = 0;
let search = "";
let targetId = "";
let toast =
  saved && !run ? "旧存档或损坏存档无法恢复，可以安全开启新远征。" : "";
function loadAudio() {
  try {
    return audioSettings(JSON.parse(read("agent-spire.audio.v2") ?? "null"));
  } catch {
    return audioSettings(null);
  }
}
const audio = new GameAudio(loadAudio());
const isMuted = () => !audio.settings.music && !audio.settings.effects;
function saveAudio(): void {
  write("agent-spire.audio.v2", JSON.stringify(audio.settings));
}
let lastReward = "";
let savedAt = false;
const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const btn = (action: string, content: string, cls = "", extra = "") =>
  `<button class="${cls}" data-action="${action}" ${extra}>${content}</button>`;
const ACTS = CHAPTERS.map((name, index) => ({
  name: `第 ${index + 1} 幕 · ${name}`,
  chapters: `第 ${index + 1} 章`,
  boss: CHAPTER_BOSSES[index],
}));
const roomInfo: Record<RoomKind, { name: string; icon: string; desc: string }> =
  {
    combat: {
      name: "未知遭遇",
      icon: "sword",
      desc: "击败认知迷雾中的敌人，获得金币与新的知识卡牌。",
    },
    elite: {
      name: "精英挑战",
      icon: "crown",
      desc: "危险的守卫盘踞于此。胜利将带来额外遗物。",
    },
    boss: {
      name: "守关首领",
      icon: "crown",
      desc: "击败本幕首领并完成知识试炼，进入更高的境界。",
    },
    quiz: {
      name: "知识试炼",
      icon: "book",
      desc: "用原书中的工程原则作答，获得金币、生命与掌握度。",
    },
    rest: {
      name: "休憩之所",
      icon: "flame",
      desc: "休息回复 30% 最大生命，或升级一张卡牌。",
    },
    shop: {
      name: "旅人集市",
      icon: "bag",
      desc: "用金币交换卡牌、遗物与药水，或精简你的牌组。",
    },
    event: {
      name: "迷雾事件",
      icon: "question",
      desc: "一份遗落的手稿，一次未知的抉择。",
    },
    treasure: {
      name: "古老遗藏",
      icon: "box",
      desc: "发现一件新的遗物和 25 枚金币。",
    },
  };

function remember(): void {
  if (!run) return;
  profile.learned = [...new Set([...profile.learned, ...run.learned])];
  // A run records successful trials; preserve the best demonstrated mastery across runs.
  for (const [id, n] of Object.entries(run.mastery))
    profile.mastery[id] = Math.max(profile.mastery[id] ?? 0, n);
  if (run.screen === "victory" && !profile.completedSeeds.includes(run.seed)) {
    profile.victories++;
    profile.completedSeeds.push(run.seed);
  }
  write(PROFILE_KEY, JSON.stringify(profile));
}
function update(next: Run, deferRender = 0): void {
  if (next === run) return;
  if (next.position !== run?.position || next.seed !== run?.seed || next.character !== run?.character ||
    next.battle?.lab?.caseId !== run?.battle?.lab?.caseId || next.battle?.lab?.choice !== run?.battle?.lab?.choice ||
    next.battle?.lab?.transfer !== run?.battle?.lab?.transfer) labHintVisible = false;
  run = next;
  remember();
  write(SAVE_KEY, encodeRun(run));
  savedAt = storageAvailable;
  if (
    run.battle &&
    !run.battle.enemies.some((e) => e.id === targetId && e.hp > 0)
  )
    targetId = run.battle.enemies.find((e) => e.hp > 0)?.id ?? "";
  if (deferRender) presentationTimer = window.setTimeout(render, deferRender);
  else render();
}
function flash(message: string): void {
  toast = message;
  render();
  window.setTimeout(() => {
    if (toast === message) {
      toast = "";
      render();
    }
  }, 3500);
}
function heading(_eyebrow: string, title: string, subtitle = ""): string {
  return `<div class="page-heading"><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ""}</div>`;
}
function nav(): string {
  return `<aside class="rail"><button class="rail-mark" data-action="home" aria-label="返回首页">${icon("tower", "", 31)}</button><div class="rail-line"></div>
    ${btn("expedition", icon("compass") + "<span>远征</span>", `rail-item ${view !== "codex" ? "active" : ""}`, 'title="远征地图"')}
    ${btn("codex", icon("book") + "<span>图鉴</span>", `rail-item ${view === "codex" ? "active" : ""}`, 'title="知识图鉴"')}
    ${btn("deck", icon("layers") + "<span>牌组</span>", "rail-item", 'title="查看牌组"')}
    <div class="rail-bottom">${btn("help", icon("question"), "rail-item", 'aria-label="如何游玩" title="如何游玩"')}
    ${btn("sound", icon(isMuted() ? "mute" : "sound"), "rail-item", `aria-label="${isMuted() ? "开启" : "关闭"}声音" title="${isMuted() ? "开启" : "关闭"}声音"`)}<span class="rail-version">V 0.1</span></div></aside>`;
}
function topbar(): string {
  const active = view === "game" && run;
  return `<header class="topbar"><button class="wordmark" data-action="home">AGENT <span>尖塔</span><i>✦</i></button>
    ${
      active
        ? `<div class="run-stats"><span class="hp-stat">${icon("heart", "", 17)} <b>${run!.player.hp}</b><small>/ ${run!.player.maxHp}</small></span><span class="gold-stat">${icon("coin", "", 18)} <b>${run!.player.gold}</b></span>
      <button class="top-deck" data-action="deck">${icon("layers", "", 18)} ${run!.deck.length}</button><span class="stat-sep"></span><span class="floor-stat">第 ${run!.act} 幕 <i>·</i> ${run!.floors} 层</span></div>`
        : ""
    }
    <div class="top-actions">${active ? `<span class="save-indicator"><i></i>${storageAvailable ? (savedAt ? "已自动保存" : "自动存档") : "本次进度未保存"}</span>` : ""}${btn("settings", icon("settings", "", 19), "icon-button", 'aria-label="设置与来源" title="设置与来源"')}</div></header>`;
}
function home(): string {
  const canContinue = run && !["victory", "defeat"].includes(run.screen);
  return `<main class="home-page study-home"><section class="study-intro"><div class="study-copy"><h1>深入理解 <span>AI Agent</span></h1><p class="core-formula">LLM + 上下文 + 工具</p><div class="home-buttons">${btn(canContinue ? "continue" : "new", canContinue ? "继续学习" : "开始学习", "primary-button start-button")}${btn("codex", "知识图鉴", "secondary-button")}${canContinue ? btn("new", "新开一局", "text-button") : ""}</div></div><div class="approved-party" aria-label="三个学习角色"><div class="home-heroes">${MODELS.map((m) => modelSprite(m.id)).join("")}</div><div class="model-identities">${MODELS.map((m) => `<span class="model-identity">${modelLogo(m.id, 16)}${m.name}</span>`).join("")}</div></div></section><section class="study-chapters" aria-label="按原书章节学习"><h2>章节练习</h2><div class="home-chapter-grid">${CHAPTERS.map((name, i) => btn("study-chapter", `<span>${String(i + 1).padStart(2, "0")}</span><b>${name}</b>${icon("arrow", "", 16)}`, "home-chapter", `data-index="${i + 1}"`)).join("")}</div></section></main>`;
}
function relicRow(): string {
  return `<div class="relic-row">${run!.player.relics.filter(id => isRelicForCharacter(id, run!.character)).map((id) => `<span class="relic" title="${RELICS[id].name}：${RELICS[id].description}">${icon(RELICS[id].icon, "", 21)}</span>`).join("")}<small>遗物</small></div>`;
}
function mapPage(): string {
  const r = run!;
  const act = ACTS[r.act - 1];
  const chapter = LESSON_BY_ID[(availableNodes(r)[0] ?? r.map.find(n => n.id === r.position) ?? r.map[0]).lessonId].chapter;
  const options = availableNodes(r).map((n) => n.id);
  const x = (col: number) => [26, 50, 74][col];
  const y = (row: number) => 91 - row * 10;
  const lines = r.map
    .flatMap((n) =>
      n.next.map((id) => {
        const dest = r.map.find((d) => d.id === id)!;
        const seen = r.visited.includes(n.id) && r.visited.includes(id);
        const live = r.position === n.id && options.includes(id);
        return `<path class="${seen ? "traversed" : live ? "reachable" : ""}" d="M${x(n.col)},${y(n.row)} C${x(n.col)},${y(n.row) - 5} ${x(dest.col)},${y(dest.row) + 5} ${x(dest.col)},${y(dest.row)}"/>`;
      }),
    )
    .join("");
  return `<main class="map-page"><div class="map-main">${heading("", act.name, act.chapters)}
    <div class="map-legend">${(["combat", "elite", "quiz", "rest", "shop", "event", "treasure"] as RoomKind[]).map((k) => `<span title="${roomInfo[k].desc}">${icon(roomInfo[k].icon, "", 14)}${roomInfo[k].name}</span>`).join("")}</div>
    <div class="tower-map"><div class="map-filigree"></div><svg class="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
    ${r.map
      .map((n) => {
        const available = options.includes(n.id);
        const visited = r.visited.includes(n.id);
        const current = r.position === n.id;
        return `<button class="map-node ${available ? "available" : ""} ${visited ? "visited" : ""} ${current ? "current" : ""} ${n.kind === "boss" ? "boss-node" : ""}" data-action="node" data-id="${n.id}" style="left:${x(n.col)}%;top:${y(n.row)}%" ${available ? "" : "disabled"} aria-label="第 ${n.row + 1} 层 ${roomInfo[n.kind].name}${available ? "，可前往" : ""}" title="第 ${LESSON_BY_ID[n.lessonId].chapter} 章 · ${roomInfo[n.kind].name} · ${roomInfo[n.kind].desc}">${icon(visited ? "check" : roomInfo[n.kind].icon, "", n.kind === "boss" ? 31 : 22)}<small class="node-chapter">${LESSON_BY_ID[n.lessonId].chapter}</small>${n.kind === "boss" ? `<span>${act.boss}</span>` : ""}</button>`;
      })
      .join("")}<div class="map-start">选择亮起的下一层节点</div></div></div>
    <aside class="journey-panel"><div class="journal-heading"><h2>远征手记</h2>${icon("book", "", 23)}</div>
      <div class="traveler-card"><div class="traveler-portrait">${heroArt(CHARACTERS.find((c) => c.id === r.character)!.color, modelForCharacter(run!.character))}</div><div><h3>${CHARACTERS.find((c) => c.id === r.character)!.name}</h3><small>生命 ${r.player.hp} / ${r.player.maxHp}</small></div></div>
      ${relicRow()}${r.preparation ? `<p class="encounter-preparation">下一战准备：${r.preparation.ward ? "一次隔离保护 " : ""}${r.preparation.review ? "固定种子复测押注" : ""}</p>` : ""}<div class="journal-section"><span class="section-number">${String(chapter).padStart(2,"0")}</span><div><span class="eyebrow">下一层学习章节</span><h3>${CHAPTERS[chapter-1]}</h3><p>第 ${chapter} 章 · 战斗决策与试炼对应本章</p></div></div>
      <div class="chapter-list">${CHAPTERS.map((name, i) => ({
        name,
        n: i + 1,
      }))
        .filter((c) => actLessons(r.act).some((l) => l.chapter === c.n))
        .map(
          (c) =>
            `<div><span>${String(c.n).padStart(2, "0")}</span><b>${c.name}</b>${icon("spark", "", 12)}</div>`,
        )
        .join("")}</div>
      <div class="knowledge-progress"><div><span>本次认知收获</span><b>${r.learned.length}<small> / ${LESSONS.length}</small></b></div><div class="progress-track"><i style="width:${(r.learned.length / LESSONS.length) * 100}%"></i></div><p>打出卡牌发现知识，完成试炼加深理解。</p></div>
      
      ${btn("deck", `${icon("layers", "", 17)} 查看牌组 <span>${r.deck.length}</span>`, "journal-deck")}
      <small class="seed-caption">远征种子 ${r.seed}</small></aside></main>`;
}
function cardView(
  card: Card,
  action = "",
  index = 0,
  disabled = false,
): string {
  const d = statsFor(card);
  if (run && (action === "play" ? !isCardForCharacter(card.defId, run.character) : ["reward", "buy-card"].includes(action) && !canAcquireCard(card.defId, run.character, run.act))) disabled = true;
  const lesson = LESSON_BY_ID[d.lesson];
  const synergy = action === "play" && run ? synergyFor(run, card) : null;
  const description = action === "play" && run ? cardText(card, run.player.strength + burstBonus(run, card), run.player.weak) : cardText(card);
  return `<button class="game-card ${d.type} ${d.rarity} ${card.upgraded ? "upgraded" : ""} ${disabled ? "unaffordable" : ""}" ${action ? `data-action="${action}" data-id="${esc(card.uid)}"` : ""} style="--i:${index}" ${disabled ? "disabled" : ""} aria-label="${esc(d.name)}${card.upgraded ? "升级" : ""}，${d.cost}能量，${esc(description)}" title="${esc(lesson.concept)} · ${sourceLabel(lesson)}">
    <span class="card-cost">${d.cost}</span><span class="card-name">${d.name}${card.upgraded ? "<sup>+</sup>" : ""}</span><span class="card-art">${cardIllustration(d.id)}</span>
    <span class="card-type">${{ attack: "攻击", skill: "技能", power: "能力" }[d.type]}<i>◆</i>${d.character ? CHARACTERS.find(c => c.id === d.character)!.name + "专属" : { basic: "基础", common: "普通", uncommon: "罕见", rare: "稀有" }[d.rarity]}</span>
    <span class="card-description">${description}</span>${synergy?.label ? `<span class="card-synergy" title="${synergy.explanation}">${synergy.label}${synergy.damage ? ` · 伤害 +${synergy.damage}` : synergy.block ? ` · 格挡 +${synergy.block}` : synergy.energy ? " · 能量 +1" : " · 抽牌 +1"}</span>` : ""}<span class="card-source">§${lesson.section} · ${lesson.title}</span>${action === "play" && index < 9 ? `<span class="card-key">${index + 1}</span>` : ""}</button>`;
}
function battlePage(): string {
  const r = run!;
  const b = r.battle!;
  const unlocked = combatUnlocked(r);
  const hero = CHARACTERS.find((c) => c.id === r.character)!;
  const bossEnemy = b.enemies.find(e => e.boss);
  const bossRule = bossEnemy?.boss ? BOSS_RULES[bossEnemy.boss.kind] : null;
  const bait = b.enemies.find(e => e.hp > 0 && e.boss?.kind === "reward");
  const knowledge = LESSON_BY_ID[activeLessonId && LESSON_BY_ID[activeLessonId].chapter === r.act ? activeLessonId : caseForBattle(r).lesson];
  const currentTarget =
    b.enemies.find((e) => e.id === targetId && e.hp > 0) ??
    b.enemies.find((e) => e.hp > 0)!;
  targetId = currentTarget.id;
  return `<main class="battle-page" data-locked="${!unlocked}"><div class="combat-layout"><section class="combat-stage"><div class="battle-top"><div><h2>第 ${LESSON_BY_ID[r.map.find(n => n.id === r.position)!.lessonId].chapter} 章 · ${b.room === "boss" ? "守关之战" : b.room === "elite" ? "精英挑战" : "普通战斗"}</h2></div><div class="turn-badge"><span>你的回合</span><b>${String(b.turn).padStart(2, "0")}</b></div><div class="potion-bar">${r.player.potions.map((p, i) => btn("potion", icon("flask", p, 24), `potion ${p}`, `data-index="${i}" ${unlocked ? "" : "disabled"} title="${{ heal: "治疗药水：回复 20 生命", energy: "能量药水：获得 2 能量", fire: "烈焰药水：对选定敌人造成 20 伤害" }[p]}" aria-label="${{ heal: "使用治疗药水", energy: "使用能量药水", fire: "使用烈焰药水" }[p]}"`)).join("")}<small>药水</small></div></div>
    <div class="battlefield"><div class="arena-arch"></div><div class="arena-floor"></div><div class="fighter player-fighter"><div class="fighter-label" title="${hero.description}"><b>${hero.name}</b><small>${hero.energy} 能量 · 抽 ${hero.draw} 张${hero.strength ? ` · 力量 +${hero.strength}` : ""}</small></div>${heroArt(hero.color, modelForCharacter(run!.character))}<div class="health-bar"><i style="width:${(r.player.hp / r.player.maxHp) * 100}%"></i><span>${icon("heart", "", 12)} ${r.player.hp} / ${r.player.maxHp}</span></div><div class="status-row">${r.player.relics.includes("reset") && isRelicForCharacter("reset", r.character) ? btn("reset", `重置 ${r.player.resetCharges ?? 0}/1`, "text-button reset-relic", `${!unlocked || r.player.resetCharges !== 1 || r.player.hp >= r.player.maxHp ? "disabled" : ""} title="${RELICS.reset.description}" aria-label="使用重置：回复全部生命"`) : ""}${r.player.block ? `<span title="格挡抵御伤害，下回合开始时清空（保留效果除外）">${icon("shield", "", 15)} ${r.player.block}</span>` : ""}${r.player.strength ? `<span title="力量：增加攻击牌伤害">${icon("sword", "", 15)} ${r.player.strength}</span>` : ""}${r.player.weak ? `<span class="debuff" title="虚弱：攻击伤害降低 25%">虚弱 ${r.player.weak}</span>` : ""}${r.player.vulnerable ? `<span class="debuff" title="易伤：受到的攻击伤害增加 50%">易伤 ${r.player.vulnerable}</span>` : ""}${b.cache ? `<span title="缓存：每回合额外能量">缓存 ${b.cache}</span>` : ""}${b.retention ? "<span>保留 8</span>" : ""}</div></div>
    <div class="versus-sigil">✦</div><div class="enemies">${b.enemies
      .map((e) => {
        const intent = enemyIntent(e, b.turn);
        const intentIcon =
          intent.kind === "defend"
            ? "shield"
            : intent.kind === "weaken"
              ? "eye"
              : "sword";
        return `<button class="fighter enemy-fighter ${e.hp <= 0 ? "slain" : ""} ${e.id === targetId ? "targeted" : ""}" data-action="target" data-id="${e.id}" ${e.hp <= 0 ? "disabled" : ""} aria-label="选择目标 ${e.name}" title="点击选为攻击目标"><div class="enemy-intent ${intent.kind}" title="下回合：${intent.kind === "defend" ? "获得格挡" : intent.kind === "weaken" ? "对你施加虚弱" : "攻击"}">${icon(intentIcon, "", 20)}<b>${intent.value}</b><small>${intent.kind === "defend" ? "防御" : intent.kind === "weaken" ? "干扰" : intent.kind === "heavy" ? "重击" : "攻击"}</small></div>${enemyArt(e.art, e.id)}<b class="enemy-name">${e.name}</b>${e.trait ? `<span class="enemy-rule" title="${e.trait === "rage" ? "每次行动后，基础攻击永久增加 1。拖延会使后续攻击更危险。" : "每次行动后额外获得 4 点格挡。需要连携和集中攻击。"}">${e.trait === "rage" ? "蓄势 · 每回合攻击 +1" : "装甲 · 每回合格挡 +4"}</span>` : ""}<div class="health-bar enemy-health"><i style="width:${(e.hp / e.maxHp) * 100}%"></i><span>${e.hp} / ${e.maxHp}</span></div><div class="status-row">${e.block ? `<span>${icon("shield", "", 15)} ${e.block}</span>` : ""}${e.weak ? `<span>虚弱 ${e.weak}</span>` : ""}${e.vulnerable ? `<span>易伤 ${e.vulnerable}</span>` : ""}${e.poison ? `<span>侵蚀 ${e.poison}</span>` : ""}</div><span class="target-marker">${e.id === targetId ? "当前目标" : "点击选择"}</span></button>`;
      })
      .join("")}</div></div>
    ${b.ward || b.review ? `<p class="encounter-preparation" role="status">${b.ward ? "隔离保护：下一次敌人攻击或反击被抵消。 " : ""}${b.review ? { pending: "固定种子复测：等待两步决策结果。", passed: "复测通过：额外 60 金币与 10 治疗已结算。", failed: "复测未通过：押注预算不返还。" }[b.review] : ""}</p>` : ""}
    ${bossRule ? `<section class="boss-mechanic" aria-label="本章首领机制"><h3>${bossRule.name}<small>${sourceLabel(LESSON_BY_ID[bossRule.lesson])}</small></h3><p>${bossRule.text}</p><div class="boss-progress">${b.enemies.filter(e => e.boss).map(e => `<span>${e.name}：${e.hp > 0 ? bossStatus(e, b.turn) : "已击败"}</span>`).join("")}</div>${bait ? btn("boss-bait", "领取诱饵：+2 能量；首领回血 20、攻击永久 +3", "secondary-button", !unlocked || (bait.boss?.kind === "reward" && bait.boss.claimed) ? "disabled" : "") : ""}</section>` : ""}
    <div class="combat-ribbon combat-knowledge"><div><b>${knowledge.title}</b><p>${knowledge.concept}</p><small>§${knowledge.section} · 书内 p.${knowledge.page}</small></div>${btn("card-principle", "查看原理", "text-button")}</div>
    ${!unlocked ? `<div class="decision-gate" role="status">${icon("lock", "", 18)} 完成两步工程决策，解锁出牌 ${btn("focus-lab", "去作答", "text-button")}</div>` : ""}<div class="hand-zone"><button class="pile draw-pile" data-action="draw"><span class="pile-card">${icon("tower", "", 30)}</span><b>${b.drawPile.length}</b><small>抽牌堆</small></button><div class="energy-orb" title="每回合恢复能量，用来打出卡牌"><b>${r.player.energy}</b><span>/ ${r.player.maxEnergy + b.cache}</span><small>能量</small></div>
    <div class="hand ${b.hand.length > 6 ? "crowded" : ""}">${b.hand.map((card, i) => cardView(card, "play", i, !unlocked || statsFor(card).cost > r.player.energy)).join("")}${!b.hand.length ? '<p class="empty-hand">手牌已空，结束回合抽取新牌。</p>' : ""}</div>
    <div class="end-turn-wrap">${btn("end-turn", "结束回合" + icon("arrow", "", 17), "end-turn", unlocked ? "" : "disabled")}<small>快捷键 E</small></div><button class="pile discard-pile" data-action="discard"><span class="pile-card">${icon("layers", "", 27)}</span><b>${b.discard.length}</b><small>弃牌堆</small></button></div>
    <div class="battle-footer"><span>点击卡牌使用 <i>·</i> 点击敌人选择目标 <i>·</i> 数字键 1—9 出牌</span>${btn("exhaust", `消耗区 ${b.exhaust.length}`, "text-button")}</div></section>${learningPanel()}</div></main>`;
}
function learningPanel(): string {
  const r = run!, c = caseForBattle(r), l = LESSON_BY_ID[c.lesson];
  const lab = r.battle!.lab, choice = lab?.choice ?? null, transfer = lab?.transfer ?? null;
  const second = transferFor(c), complete = transfer !== null;
  const verified = complete && choice === c.correct && transfer === second.correct;
  const options = choice === null ? c.options : second.options;
  const prompt = choice === null ? c.situation : second.question;
  const evidence = choice === null ? c.evidence : second.code ?? c.evidence;
  const hasCode = choice === null ? c.codeLanguage : second.codeLanguage ?? c.codeLanguage;
  const hint = caseHint(c, choice === null ? "action" : "transfer");
  return `<details class="lab-panel ${verified ? "verified" : ""}" ${labExpanded ? "open" : ""}><summary>${icon(verified ? "check" : "code", "", 18)}<b>${verified ? "理解已验证" : complete ? "案例复盘" : "工程决策"}</b><span>${complete ? l.title : choice === null ? "1 / 2 · 选对 +1 能量" : hasCode ? "2 / 2 · 错因辨析" : "2 / 2 · 验证迁移"}</span></summary><div class="lab-body"><div class="lab-source"><b>${l.title}</b>${sourceLabel(c.source ?? l)}</div>
  ${choice !== null ? `<section class="lab-feedback ${choice === c.correct ? "correct" : "incorrect"}" role="status" aria-label="上一题解析"><h3>第 1 步 · ${choice === c.correct ? "判断正确 · 能量 +1 · 抽牌 +1" : "判断有误 · 虚弱 +1"}</h3><p class="feedback-question">${esc(c.situation)}</p><p><b>你的选择：${"ABC"[choice]}</b> ${esc(c.options[choice])}</p><p><b>${choice === c.correct ? "正确原因" : "错在这里"}：</b>${esc(c.consequences[choice])}</p>${choice !== c.correct ? `<p><b>正确选项：${"ABC"[c.correct]}</b> ${esc(c.options[c.correct])}</p><p><b>为什么正确：</b>${esc(c.consequences[c.correct])}</p>` : ""}</section>` : ""}
  <p class="lab-situation">${esc(prompt)}</p>${hasCode ? `<pre class="lab-code"><code>${esc(evidence)}</code></pre><small class="lab-code-label">Python 3 · 工程练习</small>` : `<blockquote class="lab-evidence">${esc(evidence)}</blockquote>`}
  ${!complete ? `<div class="lab-hint-controls">${btn("lab-hint", labHintVisible ? "收起提示" : "提示", "lab-hint-toggle", `aria-expanded="${labHintVisible}" aria-controls="lab-hint"`)}<small>查看解题方向</small></div><aside id="lab-hint" class="lab-hint" aria-label="解题提示" ${labHintVisible ? "" : "hidden"}><p>${esc(hint.focus)}</p><small>${esc(hint.method)}</small></aside>` : ""}
  ${!complete ? `<div class="lab-options">${options.map((o,i)=>btn("lab-choice",`<span>${"ABC"[i]}</span>${esc(o)}`,"lab-choice",`data-index="${i}"`)).join("")}</div>` : `<p class="lab-result ${transfer === second.correct ? "correct" : "incorrect"}"><b>${transfer === second.correct ? "诊断验证正确" : "诊断验证有误"}</b>${esc(second.explanation)}</p><div class="lab-completion">${verified ? `${icon("seal", "", 24)}<b>掌握度 +1</b><span>格挡 +6 · 金币 +10</span>` : `<b>本次未获得掌握度</b><span>正确做法：${esc(c.options[c.correct])}；${esc(second.options[second.correct])}</span>`}</div>`}
  </div></details>`;
}
function roomFrame(content: string, cls = ""): string {
  return `<main class="room-page ${cls}"><div class="room-glow"></div>${content}</main>`;
}
function rewardPage(): string {
  const r = run!;
  const reward = r.reward!;
  return roomFrame(
    `${heading("", "选择一张卡牌", "金币和遗物随选牌或跳过一起领取。")}<div class="reward-resources"><span>${icon("coin")} +${reward.gold} 金币</span>${reward.relic ? `<span title="${RELICS[reward.relic].description}">${icon(RELICS[reward.relic].icon)} ${RELICS[reward.relic].name}</span>` : ""}${r.player.relics.includes("lantern") ? `<span>${icon("heart")} 求知之灯已回复生命</span>` : ""}</div>
    <div class="reward-cards">${reward.cards.map((c) => cardView(c, "reward")).join("")}</div><p class="muted small">卡牌数值是游戏规则；卡牌背后的知识可在图鉴中溯源。</p>${btn("skip-reward", "跳过选牌，领取其他奖励" + icon("arrow", "", 17), "secondary-button")}`,
    "reward-page",
  );
}
function quizPage(): string {
  const q = run!.quiz!;
  const l = trialQuestion(q);
  const answered = q.selected !== null;
  const t = q.trial;
  const score = trialScore(q);
  const final = !!t && t.step === 2 && answered;
  const reward = t?.reward;
  const rewardText = reward ? [reward.gold ? `${reward.gold} 金币` : "", reward.heal ? `回复 ${reward.heal} 生命` : "", reward.relic ? RELICS[reward.relic].name : "", reward.potion ? "能量药水" : ""].filter(Boolean).join(" · ") : "";
  return roomFrame(
    `${heading("", t ? TRIAL_BY_ID[t.id].title : "知识试炼", sourceLabel(l))}<div class="quiz-sheet ${final ? "trial-complete" : ""}">${t ? `<div class="trial-progress" aria-label="试炼进度">${[0,1,2].map(i => `<span class="${i < t.answers.length ? t.answers[i] === trialQuestionAt(q,i).correct ? "passed" : "missed" : i === t.step ? "active" : ""}">${i + 1}</span>`).join("")}<b>${score} / 3 正确</b></div>` : ""}<span class="eyebrow">${l.kind ? {trace:"代码追踪",debug:"故障排查",tradeoff:"工程取舍"}[l.kind] + " · " : ""}${l.title}</span><h2>${esc(l.question)}</h2>${l.code ? `<pre class="trial-code"><code>${esc(l.code)}</code></pre><small class="trial-code-label">${l.codeLanguage === "python" ? "Python 3 · 按原书机制设计的工程练习" : "按原文机制改写的教学伪代码"}</small>` : ""}<div class="quiz-options">${l.options.map((option, i) => btn("answer", `<span class="option-letter">${"ABC"[i]}</span><span>${esc(option)}</span>${answered && i === l.correct ? icon("check", "", 19) : ""}`, `quiz-option ${answered && i === l.correct ? "correct" : ""} ${answered && i === q.selected && !q.correct ? "incorrect" : ""}`, `data-index="${i}" ${answered ? "disabled" : ""}`)).join("")}</div>
    ${answered ? `<div class="quiz-explanation ${q.correct ? "success" : ""}" role="status"><h3>${icon(q.correct ? "check" : "book", "", 19)} ${q.correct ? "实现正确 · 掌握度 +1" : "实现有误，查看原因"}</h3><p>${esc(l.explanation)}</p>${l.optionReasons ? `<div class="option-analysis" aria-label="选项解析">${l.optionReasons.map((reason,i)=>`<div class="${i === l.correct ? "is-correct" : ""}"><b>${"ABC"[i]}${i === l.correct ? " · 正确" : ""}${i === q.selected ? " · 你的选择" : ""}</b><p>${esc(reason)}</p></div>`).join("")}</div>` : ""}<small>${sourceLabel(l)}</small></div>${final ? `<div class="trial-loot ${score === 3 ? "perfect" : score >= 2 ? "passed" : "failed"}" role="status"><strong>${score === 3 ? "完美通关" : score >= 2 ? "试炼通过" : "试炼未通过"}</strong>${rewardText ? `<p>${rewardText}</p>${reward?.relic ? `<small>${icon(RELICS[reward.relic].icon, "", 20)} ${RELICS[reward.relic].description}</small>` : ""}` : "<p>答对至少 2 题可获得通关奖励。原理已保留，可继续复习。</p>"}</div>` : ""}${btn("finish-quiz", `${t && !final ? "下一步" : rewardText ? "领取奖励" : q.boss ? (run!.act === CHAPTERS.length ? "完成远征" : "进入下一幕") : "继续前进"}${icon("arrow", "", 18)}`, "primary-button")}` : ""}${t && !final ? '<p class="quiz-reward">2 / 3：80 金币 + 治疗 + 能量药水<br>3 / 3：140 金币 + 治疗 + 永久遗物</p>' : ""}</div>`,
    "quiz-page",
  );
}
function restPage(): string {
  return roomFrame(
    `${heading("", "休息或升级", "本次只能选择一项。")}<div class="room-emblem campfire">${icon("flame", "", 110)}<span></span></div><div class="choice-row">${btn("rest-heal", `${icon("heart", "", 31)}<h3>休息</h3><p>回复 ${Math.ceil(run!.player.maxHp * 0.3)} 点生命</p><small>当前 ${run!.player.hp} / ${run!.player.maxHp}</small>`, "choice-card")}${btn("upgrade", `${icon("spark", "", 31)}<h3>研习</h3><p>升级一张牌，增强它的效果</p><small>这次休憩只能选择一项</small>`, "choice-card", run!.deck.every((c) => c.upgraded) ? "disabled" : "")}</div>`,
    "rest-page",
  );
}
function shopPage(): string {
  const r = run!;
  const shop = r.shop!;
  return roomFrame(
    `${heading("", "商店")}<div class="shop-cards">${shop.cards.map((o) => `<div class="shop-offer ${o.sold ? "sold" : ""}">${cardView(o.card, o.sold ? "" : "buy-card", 0, o.sold || r.player.gold < o.price)}<span>${icon("coin", "", 17)} ${o.sold ? "已售出" : o.price}</span></div>`).join("")}</div><div class="shop-extras">${btn("buy-relic", `${icon(RELICS[shop.relic].icon, "", 27)}<span><b>${RELICS[shop.relic].name}</b><small>${RELICS[shop.relic].description}</small></span><em>${shop.relicSold ? "已售出" : "125 金币"}</em>`, "shop-extra", shop.relicSold || r.player.gold < 125 ? "disabled" : "")}${btn("buy-potion", `${icon("flask", "", 27)}<span><b>治疗药水</b><small>战斗中回复 20 生命，最多携带 3 瓶。</small></span><em>30 金币</em>`, "shop-extra", r.player.gold < 30 || r.player.potions.length >= 3 ? "disabled" : "")}${btn("remove", `${icon("compress", "", 27)}<span><b>精简牌组</b><small>移除一张牌，每间商店限一次。</small></span><em>${shop.removed ? "已使用" : "50 金币"}</em>`, "shop-extra", shop.removed || r.player.gold < 50 || r.deck.length <= 5 ? "disabled" : "")}</div>${btn("leave-shop", "继续前进" + icon("arrow", "", 17), "secondary-button")}`,
    "shop-page",
  );
}
function eventPage(): string {
  const view = eventView(run!);
  return roomFrame(
    `${heading("", view.title, sourceLabel(LESSON_BY_ID[view.lesson]))}<p class="event-story">${view.story}</p><div class="event-sheet"><div class="room-emblem">${icon("book", "", 90)}</div><div class="event-choices">${btn("event-study", `<span>${icon("book")}<b>${view.study}</b><small>进入本章知识试炼</small></span>${icon("arrow", "", 18)}`, "event-choice")}${view.targeted ? `<section class="event-contract"><h3>${view.risk}</h3><p>${view.effect}</p><small>${view.disabled || "点击下方一张牌执行此选择"}</small></section>` : btn("event-risk", `<span>${icon("coin")}<b>${view.risk}</b><small>${view.effect}${run!.act === 10 && view.relic ? ` 本次获得：${eventRelicLabel(run!)}` : ""}</small>${view.disabled ? `<em>${view.disabled}</em>` : ""}</span>${icon("arrow", "", 18)}`, "event-choice dangerous", view.disabled ? "disabled" : "")}${btn("event-leave", "离开", "text-button")}</div></div>${view.targeted ? `<div class="event-targets">${view.targets.map(c => cardView(c, "event-risk", 0, !!view.disabled)).join("")}</div>` : ""}`,
    "event-page",
  );
}
function treasurePage(): string {
  return roomFrame(
    `${heading("", "宝箱")}<div class="room-emblem treasure-emblem">${icon("box", "", 120)}</div><p class="room-description">获得一件遗物与 25 枚金币。遗物的力量会伴随整场远征。</p>${btn("treasure", "开启遗藏" + icon("spark", "", 19), "primary-button")}`,
  );
}
function endingPage(): string {
  const r = run!;
  const won = r.screen === "victory";
  const correct = r.answers.filter((a) => a.correct).length;
  return roomFrame(
    `${heading(won ? "THE ASCENT IS ONLY THE BEGINNING" : "EVERY ENDING LEAVES A TRACE", won ? "远征完成" : "本次远征结束", "已学知识已保存，可在图鉴复习。")}<div class="room-emblem ending-emblem">${icon(won ? "crown" : "lantern", "", 95)}</div><div class="end-stats"><div><b>${r.floors}</b><span>探索层数</span></div><div><b>${r.learned.length}</b><span>发现知识</span></div><div><b>${correct}<small> / ${r.answers.length}</small></b><span>试炼答对</span></div><div><b>${r.deck.length}</b><span>最终牌组</span></div></div><div class="ending-actions">${btn("new", "再次启程" + icon("arrow", "", 17), "primary-button")}${btn("codex", "回顾知识图鉴", "secondary-button")}${btn("deck", "查看最终牌组", "text-button")}</div>`,
    "ending-page",
  );
}
function gamePage(): string {
  if (!run) return home();
  switch (run.screen) {
    case "map":
      return mapPage();
    case "combat":
      return battlePage();
    case "reward":
      return rewardPage();
    case "quiz":
      return quizPage();
    case "rest":
      return restPage();
    case "shop":
      return shopPage();
    case "event":
      return eventPage();
    case "treasure":
      return treasurePage();
    default:
      return endingPage();
  }
}
function codexPage(): string {
  const lessons = LESSONS.filter(
    (l) =>
      (!chapterFilter || l.chapter === chapterFilter) &&
      (!search ||
        `${l.title}${l.concept}${CHAPTERS[l.chapter - 1]}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  return `<main class="codex-page">${heading("", "知识图鉴")}<div class="codex-summary"><span>${icon("spark", "", 19)} 已探索 <b>${profile.learned.length}</b> / ${LESSONS.length}</span><span>${icon("seal", "", 19)} 已验证理解 <b>${Object.values(profile.mastery).filter((n) => n > 0).length}</b></span><span>${icon("book", "", 19)} ${SOURCE.author} · ${SOURCE.version}</span></div>
    <div class="codex-controls"><div class="chapter-filter">${btn("chapter", "全部章节", chapterFilter === 0 ? "selected" : "", 'data-index="0"')}${CHAPTERS.map((name, i) => btn("chapter", `${String(i + 1).padStart(2, "0")} ${name}`, chapterFilter === i + 1 ? "selected" : "", `data-index="${i + 1}"`)).join("")}</div><label class="search-field">${icon("search", "", 19)}<input id="knowledge-search" type="search" placeholder="搜索知识与概念…" value="${esc(search)}" aria-label="搜索知识与概念"></label></div>
    <div class="lesson-grid">${lessons.map((l) => `<button class="lesson-card ${profile.learned.includes(l.id) ? "discovered" : ""}" data-action="lesson" data-id="${l.id}"><span class="lesson-chapter">第 ${l.chapter} 章<i>${profile.learned.includes(l.id) ? "已探索" : "可研读"}</i></span><h3>${l.title}${icon("arrow", "", 17)}</h3><p>${l.concept}</p><div class="lesson-card-footer"><small>§${l.section} · 书内 p.${l.page}</small><span class="mastery-dots">${[1, 2, 3].map((n) => `<i class="${(profile.mastery[l.id] ?? 0) >= n ? "filled" : ""}"></i>`).join("")}</span></div></button>`).join("")}${lessons.length ? "" : '<p class="empty-results">没有找到匹配的知识点，请换个关键词。</p>'}</div><p class="source-note">知识解释与试题为基于原书的转述；卡牌效果、人物、关卡与数值为原创游戏设计。图鉴覆盖十章核心概念，不替代全书阅读。</p></main>`;
}
function modalContent(): string {
  if (modal === "characters") {
    const selected = CHARACTERS.find((c) => c.id === selectedChar)!;
    return `<h2>选择角色</h2><div class="character-grid">${CHARACTERS.map((c) => `<button class="character-option ${selectedChar === c.id ? "selected" : ""}" data-action="select-character" data-id="${c.id}"><div>${heroArt(c.color, modelForCharacter(c.id))}</div><h3>${c.name}</h3><small>${c.hp} 生命</small><small>${c.energy} 能量 · 每回合抽 ${c.draw} 张</small></button>`).join("")}</div><div class="character-detail"><p>${selected.description}</p><p>专属起始牌：${[...new Set(selected.starterDeck.filter(id => CARD_BY_ID[id].character === selected.id))].map(id => CARD_BY_ID[id].name).join("、")}</p><small>${RELICS[selected.relic as keyof typeof RELICS].name}：${RELICS[selected.relic as keyof typeof RELICS].description}</small></div><div class="begin-row"><label class="seed-input">远征种子（可选）<input id="seed" placeholder="留空则随机" value="${esc(seedDraft)}" maxlength="30" autocomplete="off"></label>${btn("begin", "踏入尖塔", "primary-button")}</div>${run && !["victory", "defeat"].includes(run.screen) ? '<p class="small muted">新开一局会替换当前远征，已学知识保留。</p>' : ""}`;
  }
  if (modal === "help")
    return `<h2>你的第一场远征</h2><div class="help-grid"><article><b>01</b><h3>沿路线向上</h3><p>选择闪光的相邻节点。战斗、试炼、事件、商店与休憩各有收获。每幕第九层是首领，共三幕。</p></article><article><b>02</b><h3>观察，然后行动</h3><p>敌人头顶显示下一回合意图。点击卡牌消耗能量，点击敌人切换目标。攻击造成伤害，格挡抵御攻击。</p></article><article><b>03</b><h3>构筑你的能力</h3><p>胜利后三选一获得新牌。篝火可以回复生命或升级卡牌。遗物持续生效；药水在战斗中使用。</p></article><article><b>04</b><h3>让理解留下来</h3><p>卡牌对应原书知识点。试炼作答后提供解释与来源。答对获得 25 金币和 5 生命；首领试炼答完即可前进。</p></article></div><div class="help-status"><p><b>状态说明</b>　力量：增加每次攻击牌伤害；虚弱：攻击伤害降低 25%；易伤：受到攻击伤害增加 50%；侵蚀：敌人行动前扣除生命，随后减少 1 层。</p><p><b>牌堆规则</b>　每回合抽 5 张、恢复基础能量。结束回合弃掉手牌；抽牌堆空后洗入弃牌。能力牌与消耗牌本场不再抽到，下一战恢复。</p><p><b>快捷键</b>　1—9 出牌 · E 结束回合 · Esc 关闭面板。进度在每次行动后保存到本机浏览器。</p></div>${btn("close", "关闭" + icon("arrow", "", 18), "primary-button")}`;
  if (modal === "settings")
    return `<h2>设置与知识来源</h2><div class="settings-row"><h3>背景音乐</h3>${btn("music", audio.settings.music ? "关闭音乐" : "开启音乐", "secondary-button", `aria-pressed="${audio.settings.music}"`)}</div><div class="settings-row"><h3>卡牌音效</h3>${btn("effects", audio.settings.effects ? "关闭音效" : "开启音效", "secondary-button", `aria-pressed="${audio.settings.effects}"`)}</div><label class="settings-row audio-volume">音量<input id="audio-volume" type="range" min="0" max="100" value="${Math.round(audio.settings.volume * 100)}" aria-label="音量"><output for="audio-volume">${Math.round(audio.settings.volume * 100)}%</output></label><div class="source-box">${icon("book", "", 29)}<h3>${SOURCE.title}</h3><p>${SOURCE.author} 著 · ${SOURCE.version}<br>共 ${SOURCE.pages} 页，知识以用户提供的 PDF 为唯一教材。</p><p>游戏中的“书内页码”为正文印刷页码；PDF 页码 = 书内页码 + 8。各知识卡都标注章节与页码，方便对照。</p><small>本作是原创教育卡牌游戏，借鉴卡牌构筑与随机爬塔机制。美术、角色与内容独立制作，与 Mega Crit 及《杀戮尖塔2》无关联。</small></div><p class="small muted">进度存于本地浏览器，不调用模型、不上传教材，不需要账号或 API 密钥。${storageAvailable ? "" : "当前浏览器禁止存储，本次进度无法持久保存。"}</p>`;
  if (modal === "lesson" || modal === "practice") {
    const l = LESSON_BY_ID[selectedLesson];
    if (modal === "lesson")
      return `<span class="eyebrow">第 ${l.chapter} 章 / ${CHAPTERS[l.chapter - 1]}</span><h2>${l.title}</h2><div class="lesson-concept">${icon("spark", "", 29)}<p>${l.concept}</p></div><div class="source-box compact"><span>知识出处</span><b>${sourceLabel(l)}</b><p>${SOURCE.author}《${SOURCE.title}》</p></div><div class="related-cards">${CARDS.filter(
        (c) => c.lesson === l.id,
      )
        .map((c) => cardView({ uid: c.id, defId: c.id, upgraded: false }))
        .join(
          "",
        )}</div><p class="small muted">卡牌效果为学习隐喻，数值不代表实际 Agent 性能。</p>${btn("practice", "检验我的理解" + icon("arrow", "", 18), "primary-button")}`;
    return `<h2>${l.title}</h2><h3 class="practice-question">${l.question}</h3><div class="quiz-options">${l.options.map((o, i) => btn("practice-answer", `<span class="option-letter">${"ABC"[i]}</span><span>${esc(o)}</span>`, `quiz-option ${practiceAnswer !== null && i === l.correct ? "correct" : ""} ${practiceAnswer === i && i !== l.correct ? "incorrect" : ""}`, `data-index="${i}" ${practiceAnswer !== null ? "disabled" : ""}`)).join("")}</div>${practiceAnswer !== null ? `<div class="quiz-explanation"><h3>${practiceAnswer === l.correct ? "理解正确" : "再认识一次这个概念"}</h3><p>${l.explanation}</p><small>${sourceLabel(l)}</small></div>${btn("next-practice", "下一个知识点" + icon("arrow", "", 17), "secondary-button")}` : '<p class="small muted">自由练习记录掌握度，不影响远征资源。</p>'}`;
  }
  const type = modal;
  const titles: Record<string, string> = {
    deck: "你的牌组",
    draw: "抽牌堆",
    discard: "弃牌堆",
    exhaust: "消耗区",
    upgrade: "选择一张牌研习",
    remove: "选择一张牌移除",
  };
  let list: Card[] = run?.deck ?? [];
  if (type === "draw")
    list = [...(run?.battle?.drawPile ?? [])].sort((a, b) =>
      a.defId.localeCompare(b.defId),
    );
  if (type === "discard") list = run?.battle?.discard ?? [];
  if (type === "exhaust") list = run?.battle?.exhaust ?? [];
  if (type === "upgrade") list = list.filter((c) => !c.upgraded);
  return `<h2>${titles[type ?? "deck"]}<small class="heading-count">${list.length} 张</small></h2><p class="muted small">${type === "draw" ? "为保留未知性，按名称显示，不暴露真实抽牌顺序。" : type === "upgrade" ? "点击选择。升级增加伤害、格挡、治疗或抽牌等效果；部分能力牌降低能耗。" : type === "remove" ? "点击选择。移除后将花费 50 金币。" : "悬停查看知识原理与来源；图鉴中可阅读完整解释。"}</p><div class="deck-grid">${list.map((c) => cardView(c, type === "upgrade" ? "do-upgrade" : type === "remove" ? "do-remove" : "card-lesson")).join("")}${!list.length ? '<p class="empty-results">这里暂时没有卡牌。</p>' : ""}</div>`;
}
function render(): void {
  window.clearTimeout(presentationTimer);
  presentationTimer = undefined;
  const focusedId = document.activeElement?.id;
  const selection =
    document.activeElement instanceof HTMLInputElement
      ? document.activeElement.selectionStart
      : null;
  app.innerHTML = `<div class="app-shell ${view === "home" ? "at-home" : ""} ${view === "game" && run?.screen === "combat" ? "in-battle" : ""}"><div class="world-background"></div><div class="grain"></div>${nav()}<div class="app-content">${topbar()}${view === "home" ? home() : view === "codex" ? codexPage() : gamePage()}</div>${toast ? `<div class="toast" role="status">${icon("spark", "", 18)}${esc(toast)}${btn("dismiss-toast", icon("close", "", 15), "icon-button", 'aria-label="关闭提示"')}</div>` : ""}${modal ? `<div class="modal-backdrop" data-action="backdrop"><section class="modal ${modal === "characters" ? "character-modal" : ""} ${["deck", "upgrade", "remove", "draw", "discard", "exhaust"].includes(modal) ? "wide-modal" : ""}" role="dialog" aria-modal="true" aria-label="${modal === "characters" ? "选择角色" : "游戏面板"}" tabindex="-1">${btn("close", icon("close", "", 23), "modal-close icon-button", 'aria-label="关闭面板"')}${modalContent()}</section></div>` : ""}</div>`;
  if (focusedId) {
    const input = document.getElementById(focusedId);
    input?.focus();
    if (
      input instanceof HTMLInputElement &&
      input.type !== "search" &&
      selection !== null
    )
      input.setSelectionRange(selection, selection);
  }
  if (
    modal &&
    !document.querySelector(".modal")?.contains(document.activeElement)
  )
    document.querySelector<HTMLElement>(".modal")?.focus();
}
function performCard(uid: string): void {
  if (!run || run.screen !== "combat") return;
  const before = run;
  const card = before.battle!.hand.find((c) => c.uid === uid);
  if (!card) return;
  const next = playCard(before, uid, targetId);
  if (next === before) return;
  const positions = capturePositions(uid);
  const target = targetId;
  const definition = statsFor(card);
  const impact = impactFor(before, next, card);
  activeLessonId = definition.lesson;
  audio.cue(
    definition.type === "attack"
      ? "attack"
      : definition.type === "power"
        ? "power"
        : definition.block
          ? "block"
          : "skill",
  );
  update(next, next.screen === "reward" ? 480 : 0);
  showCombatEffects(
    combatFeedback(before, next, card),
    positions,
    card,
    target,
    impact,
  );
  if (impact.cue) window.setTimeout(() => audio.cue(impact.cue!), 80);
}
function performTurn(): void {
  if (!run || run.screen !== "combat") return;
  const before = run;
  const positions = capturePositions();
  const next = endTurn(before);
  if (next === before) return;
  audio.cue("turn");
  const impact = impactFor(before, next);
  update(next, next.screen === "reward" ? 480 : 0);
  showCombatEffects(
    combatFeedback(before, next),
    positions,
    undefined,
    "",
    impact,
  );
  if (impact.cue) window.setTimeout(() => audio.cue(impact.cue!), 60);
}
function openModal(type: typeof modal): void {
  modal = type;
  render();
}
function begin(): void {
  const seedText =
    document.querySelector<HTMLInputElement>("#seed")?.value.trim() ?? "";
  const seed = seedText
    ? /^\d+$/.test(seedText)
      ? Number(seedText) >>> 0
      : [...seedText].reduce(
          (n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0,
          0,
        )
    : Date.now() >>> 0;
  modal = null;
  view = "game";
  targetId = "";
  run = null;
  activeLessonId = null;
  update(createRun(selectedChar, seed));
  audio.cue("click");
}
const cardDrag = installCardDrag(
  app,
  (uid) => {
    const card =
      run?.screen === "combat"
        ? run.battle?.hand.find((c) => c.uid === uid)
        : undefined;
    return card && statsFor(card).cost <= run!.player.energy ? card : undefined;
  },
  (uid, target) => {
    if (target) targetId = target;
    void audio.unlock();
    performCard(uid);
  },
);
app.addEventListener("click", (event) => {
  if (cardDrag.suppressClick()) {
    event.preventDefault();
    return;
  }
  void audio.unlock();
  const element = (event.target as HTMLElement).closest<HTMLElement>(
    "[data-action]",
  );
  if (!element || element.hasAttribute("disabled")) return;
  const action = element.dataset.action;
  const id = element.dataset.id ?? "";
  const index = Number(element.dataset.index);
  if (action === "backdrop" && event.target !== element) return;
  switch (action) {
    case "home":
      view = "home";
      modal = null;
      render();
      break;
    case "expedition":
      view = run ? "game" : "home";
      modal = null;
      render();
      break;
    case "continue":
      view = "game";
      render();
      break;
    case "new":
      seedDraft = "";
      openModal("characters");
      break;
    case "select-character":
      selectedChar = id as CharacterId;
      render();
      break;
    case "study-chapter":
      chapterFilter = index;
      search = "";
      view = "codex";
      modal = null;
      render();
      break;
    case "card-principle":
      selectedLesson = run ? (activeLessonId && LESSON_BY_ID[activeLessonId].chapter === run.act ? activeLessonId : caseForBattle(run).lesson) : "react";
      openModal("lesson");
      break;
    case "begin":
      begin();
      break;
    case "codex":
      view = "codex";
      modal = null;
      render();
      break;
    case "help":
      openModal("help");
      break;
    case "settings":
      openModal("settings");
      break;
    case "sound": {
      const enable = isMuted();
      void audio.configure({
        ...audio.settings,
        music: enable,
        effects: enable,
      });
      saveAudio();
      render();
      break;
    }
    case "music":
    case "effects":
      void audio.configure({
        ...audio.settings,
        [action]: !audio.settings[action],
      });
      saveAudio();
      render();
      break;
    case "close":
    case "backdrop":
      modal = null;
      render();
      break;
    case "deck":
      openModal("deck");
      break;
    case "draw":
    case "discard":
    case "exhaust":
      openModal(action);
      break;
    case "dismiss-toast":
      toast = "";
      render();
      break;
    case "node":
      if (run) {
        activeLessonId = null;
        labExpanded = innerWidth >= 1100;
        audio.cue("click");
        update(enterNode(run, id));
      }
      break;
    case "target":
      targetId = id;
      render();
      break;
    case "reset":
      if (run) {
        const before = run;
        const positions = capturePositions();
        const next = useReset(before);
        if (next === before) break;
        audio.cue("power");
        update(next);
        showCombatEffects(combatFeedback(before, next), positions);
        flash("重置完成 · 生命已回满 · 本幕额度已用完");
      }
      break;
    case "focus-lab":
      labExpanded = true; render();
      document.querySelector(".lab-panel")?.scrollIntoView({ block: "center", behavior: "smooth" });
      break;
    case "lab-hint":
      if (run?.screen === "combat" && run.battle && run.battle.lab?.transfer == null) {
        labHintVisible = !labHintVisible;
        const hint = document.querySelector<HTMLElement>("#lab-hint");
        const button = document.querySelector<HTMLButtonElement>('[data-action="lab-hint"]');
        if (hint && button) {
          hint.hidden = !labHintVisible;
          button.setAttribute("aria-expanded", String(labHintVisible));
          button.textContent = labHintVisible ? "收起提示" : "提示";
        }
      }
      break;
    case "lab-choice":
      if (run) {
        const before = run;
        const positions = capturePositions();
        const next = answerLab(before, index);
        if (next === before) break;
        const c = caseForBattle(next);
        const lab = next.battle!.lab!;
        labExpanded = !(lab.transfer !== null && innerWidth < 1100);
        activeLessonId = c.lesson;
        audio.cue(
          lab.transfer !== null
            ? lab.transfer === transferFor(c).correct
              ? "reward"
              : "hurt"
            : lab.choice === c.correct
              ? "combo"
              : "hurt",
        );
        update(next);
        showCombatEffects(combatFeedback(before, next), positions);
      }
      break;
    case "play":
      performCard(id);
      break;
    case "end-turn":
      performTurn();
      break;
    case "potion":
      if (run) {
        audio.cue("skill");
        update(usePotion(run, index, targetId));
      }
      break;
    case "reward":
    case "skip-reward":
      if (run) {
        audio.cue("reward");
        update(chooseReward(run, action === "reward" ? id : null));
      }
      break;
    case "answer":
      if (run) {
        const next = answerQuiz(run, index);
        if (next === run) break;
        update(next);
        if (run.quiz?.trial?.reward && trialScore(run.quiz) >= 2) {
          const perfect = trialScore(run.quiz) === 3;
          audio.cue(perfect ? "perfect" : "trial");
          showTrialCelebration(perfect,run.quiz.trial.reward);
        } else audio.cue(run.quiz?.correct ? "reward" : "turn");
      }
      break;
    case "finish-quiz":
      if (run) {
        const reward = run.quiz?.trial?.reward;
        const next = finishQuiz(run);
        if (next !== run && reward && reward.gold > 0) audio.cue("reward");
        update(next);
      }
      break;
    case "rest-heal":
      if (run) {
        audio.cue("block");
        update(rest(run, "heal"));
      }
      break;
    case "upgrade":
      openModal("upgrade");
      break;
    case "do-upgrade":
      if (run) {
        modal = null;
        update(rest(run, "upgrade", id));
        audio.cue("reward");
        flash("卡牌已升级，继续你的远征。");
      }
      break;
    case "buy-card":
      if (run) {
        update(buy(run, id));
        audio.cue("click");
      }
      break;
    case "buy-relic":
      if (run) update(buy(run, "relic"));
      break;
    case "buy-potion":
      if (run) update(buy(run, "potion"));
      break;
    case "remove":
      openModal("remove");
      break;
    case "do-remove":
      if (run) {
        modal = null;
        update(buy(run, "remove", id));
      }
      break;
    case "leave-shop":
      if (run) update(leaveRoom(run));
      break;
    case "treasure":
      if (run) {
        const next = claimTreasure(run);
        lastReward = RELICS[next.player.relics.at(-1)!].name;
        update(next);
        flash(`获得遗物「${lastReward}」与 25 金币。`);
        audio.cue("reward");
      }
      break;
    case "event-study":
    case "event-risk":
    case "event-leave":
      if (run) {
        const view = eventView(run);
        const next = resolveEvent(run, action === "event-study" ? "study" : action === "event-risk" ? "risk" : "leave", id);
        if (next !== run) { update(next); if (action === "event-risk") flash(`${view.risk}：${view.effect}`); }
      }
      break;
    case "boss-bait":
      if (run) update(takeBossBait(run));
      break;
    case "chapter":
      chapterFilter = index;
      render();
      break;
    case "lesson":
      selectedLesson = id;
      if (!profile.learned.includes(id)) {
        profile.learned.push(id);
        write(PROFILE_KEY, JSON.stringify(profile));
      }
      openModal("lesson");
      break;
    case "card-lesson": {
      const card =
        run?.deck.find((c) => c.uid === id) ??
        run?.battle?.hand.find((c) => c.uid === id) ??
        run?.battle?.discard.find((c) => c.uid === id) ??
        run?.battle?.exhaust.find((c) => c.uid === id);
      if (card) {
        selectedLesson = CARD_BY_ID[card.defId].lesson;
        openModal("lesson");
      }
      break;
    }
    case "practice":
      practiceAnswer = null;
      openModal("practice");
      break;
    case "practice-answer": {
      if (practiceAnswer !== null) break;
      practiceAnswer = index;
      if (index === LESSON_BY_ID[selectedLesson].correct)
        profile.mastery[selectedLesson] = Math.min(
          3,
          (profile.mastery[selectedLesson] ?? 0) + 1,
        );
      write(PROFILE_KEY, JSON.stringify(profile));
      audio.cue(
        index === LESSON_BY_ID[selectedLesson].correct ? "reward" : "turn",
      );
      render();
      break;
    }
    case "next-practice":
      selectedLesson =
        LESSONS[
          (LESSONS.findIndex((l) => l.id === selectedLesson) + 1) %
            LESSONS.length
        ].id;
      practiceAnswer = null;
      render();
      break;
    case "battle-log":
      flash(run?.battle?.log.slice(-3).join(" ") ?? "暂无轨迹");
      break;
  }
});
app.addEventListener(
  "toggle",
  (event) => {
    if (
      event.target instanceof HTMLDetailsElement &&
      event.target.classList.contains("lab-panel")
    )
      labExpanded = event.target.open;
  },
  true,
);
app.addEventListener("input", (event) => {
  const input = event.target as HTMLInputElement;
  if (input.id === "audio-volume") {
    void audio.configure({
      ...audio.settings,
      volume: Number(input.value) / 100,
    });
    saveAudio();
    const output = document.querySelector<HTMLOutputElement>(
      '[for="audio-volume"]',
    );
    if (output) output.value = `${input.value}%`;
  }
  if (input.id === "seed") seedDraft = input.value;
  if (input.id === "knowledge-search") {
    const position = input.selectionStart;
    search = input.value;
    render();
    const next = document.querySelector<HTMLInputElement>("#knowledge-search");
    next?.focus();
    if (position !== null) {
      try {
        next?.setSelectionRange(position, position);
      } catch {
        /* Search inputs do not expose selection on every browser. */
      }
    }
  }
});
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  if (event.key === "Escape") {
    modal = null;
    render();
    return;
  }
  if (modal && event.key === "Tab") {
    const items = [
      ...document.querySelectorAll<HTMLElement>(
        '.modal button:not(:disabled), .modal input, .modal [tabindex="0"]',
      ),
    ];
    const first = items[0];
    const last = items.at(-1);
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === document.querySelector(".modal"))
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
    return;
  }
  if (
    modal ||
    event.target instanceof HTMLInputElement ||
    !run ||
    view !== "game" ||
    run.screen !== "combat"
  )
    return;
  if (event.key.toLowerCase() === "e") {
    event.preventDefault();
    void audio.unlock();
    performTurn();
  }
  if (/^[1-9]$/.test(event.key)) {
    const card = run.battle!.hand[Number(event.key) - 1];
    if (card) {
      event.preventDefault();
      void audio.unlock();
      performCard(card.uid);
    }
  }
});
document.addEventListener("visibilitychange", () => {
  void audio.setVisible(!document.hidden);
});
window.addEventListener("pagehide", () => {
  void audio.setVisible(false);
});
window.addEventListener("pageshow", () => {
  void audio.setVisible(!document.hidden);
});
let compactCombat = innerWidth < 1100;
window.addEventListener("resize", () => {
  const next = innerWidth < 1100;
  if (next === compactCombat) return;
  compactCombat = next;
  labExpanded = !next;
  render();
});
render();
