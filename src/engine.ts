import {
  CARDS,
  CARD_BY_ID,
  CHARACTERS,
  statsFor,
  isCardForCharacter,
  canAcquireCard,
  isRelicForCharacter,
  rewardRelics,
  type Card,
  type CharacterId,
  type RelicId,
} from "./cards";
import { actLessons, chapterForRow, LESSON_BY_ID, CHAPTER_COUNT, CHAPTER_BOSSES } from "./content";
import { caseForBattle, transferFor } from "./learning-cases";
import { synergyFor } from "./synergy";
import { TRIALS, trialQuestion, trialReward, type TrialReward } from "./trials";
import { createBossState, beforeBossCard, afterBossCard, bossCardDamage, bossHpFloor, bossIntent, bossTurnEnd, type BossState } from "./boss-mechanics";
import { eventView } from "./chapter-events";

export type RoomKind =
  "combat" | "elite" | "boss" | "quiz" | "rest" | "shop" | "event" | "treasure";
export type Screen =
  | "map"
  | "combat"
  | "reward"
  | "quiz"
  | "rest"
  | "shop"
  | "event"
  | "treasure"
  | "victory"
  | "defeat";
export interface MapNode {
  id: string;
  row: number;
  col: number;
  kind: RoomKind;
  next: string[];
  lessonId: string;
}
export interface Enemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  damage: number;
  pattern: ("attack" | "defend" | "weaken" | "heavy")[];
  weak: number;
  vulnerable: number;
  poison: number;
  art: string;
  trait?: "rage" | "shell";
  boss?: BossState;
}
export interface EnemyAction {
  enemyId: string;
  kind: "attack" | "defend" | "weaken" | "heavy";
  value: number;
  damage: number;
  blocked: number;
}
export interface AttackHit {
  targetId: string;
  damage: number;
  blocked: number;
  hpBefore: number;
  hpAfter: number;
  blockBefore: number;
  blockAfter: number;
}
export interface Battle {
  turn: number;
  enemies: Enemy[];
  hand: Card[];
  drawPile: Card[];
  discard: Card[];
  exhaust: Card[];
  observed: boolean;
  cache: number;
  retention: boolean;
  log: string[];
  room: RoomKind;
  sequence?: string[];
  lab?: { caseId: string; choice: number | null; transfer: number | null; order?: number[]; transferOrder?: number[]; beginnerTransfer?: boolean };
  enemyActions?: EnemyAction[];
  attackHits?: AttackHit[];
  cardsPlayed?: number;
  burstUsed?: boolean;
  ward?: boolean;
  review?: "pending" | "passed" | "failed";
}
export interface Player {
  hp: number;
  maxHp: number;
  block: number;
  energy: number;
  maxEnergy: number;
  strength: number;
  weak: number;
  vulnerable: number;
  gold: number;
  potions: ("heal" | "energy" | "fire")[];
  relics: RelicId[];
  resetCharges?: number;
}
export interface Run {
  version: 1;
  curriculumVersion?: 2;
  seed: number;
  rng: number;
  character: CharacterId;
  act: number;
  screen: Screen;
  deck: Card[];
  player: Player;
  map: MapNode[];
  position: string | null;
  visited: string[];
  floors: number;
  battle: Battle | null;
  learned: string[];
  mastery: Record<string, number>;
  answers: { lessonId: string; correct: boolean }[];
  completedTrials?: string[];
  encounteredCases?: string[];
  quiz: {
    lessonId: string;
    selected: number | null;
    correct: boolean | null;
    boss: boolean;
    beginnerQuestion?: string;
    trial?: { id: string; step: number; answers: number[]; reward: TrialReward | null; order?: number[]; optionOrders?: number[][]; revision?: number; introOverrides?: (string | null)[] };
  } | null;
  reward: { cards: Card[]; gold: number; relic: RelicId | null } | null;
  roomDone: boolean;
  preparation?: { ward?: boolean; review?: boolean };
  shop: {
    cards: { card: Card; price: number; sold: boolean }[];
    relic: RelicId;
    relicSold: boolean;
    removed: boolean;
  } | null;
}
const clone = (run: Run): Run => structuredClone(run);
const hasRelic = (run: Run, id: RelicId): boolean =>
  isRelicForCharacter(id, run.character) && run.player.relics.includes(id);
function random(run: { rng: number }): number {
  run.rng = (run.rng + 0x6d2b79f5) >>> 0;
  let t = run.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function makeMap(act: number, rng: { rng: number }): MapNode[] {
  const lessons = actLessons(act);
  const nodes: MapNode[] = [];
  const kinds: RoomKind[] = [
    "combat",
    "quiz",
    "event",
    "combat",
    "shop",
    "elite",
    "rest",
    "treasure",
  ];
  for (let row = 0; row < 9; row++) {
    const chapterLessons = lessons.filter(l => l.chapter === chapterForRow(act, row));
    const cols = row === 8 ? [1] : [0, 1, 2];
    for (const col of cols) {
      let kind: RoomKind =
        row === 8
          ? "boss"
          : row === 0
            ? "combat"
            : row === 7
              ? "rest"
              : kinds[Math.floor(random(rng) * kinds.length)];
      if (row === 2 || (row === 5 && col !== 1)) kind = "quiz";
      if (row === 1 || row === 6) kind = "combat";
      if (row === 3) kind = col === 1 ? "combat" : "elite";
      if (row === 4) kind = col === 1 ? "shop" : "event";
      if (row === 5 && col === 1) kind = "treasure";
      nodes.push({
        id: `${act}-${row}-${col}`,
        row,
        col,
        kind,
        next:
          row === 8
            ? []
            : row === 7
              ? [`${act}-8-1`]
              : [0, 1, 2]
                  .filter((c) => Math.abs(c - col) <= 1)
                  .map((c) => `${act}-${row + 1}-${c}`),
        lessonId: chapterLessons[Math.floor(random(rng) * chapterLessons.length)].id,
      });
    }
  }
  return nodes;
}
export function createRun(
  character: CharacterId = "scholar",
  seed = Date.now(),
): Run {
  const hero = CHARACTERS.find((c) => c.id === character) ?? CHARACTERS[0];
  const run: Run = {
    version: 1,
    curriculumVersion: 2,
    seed: seed >>> 0,
    rng: seed >>> 0,
    character: hero.id,
    act: 1,
    screen: "map",
    deck: hero.starterDeck.map((defId, i) => ({ uid: `start-${i}`, defId, upgraded: false })),
    player: {
      hp: hero.hp,
      maxHp: hero.hp,
      block: 0,
      energy: hero.energy,
      maxEnergy: hero.energy,
      strength: 0,
      weak: 0,
      vulnerable: 0,
      gold: 99,
      potions: ["heal", "energy"],
      relics: [hero.relic as RelicId],
      resetCharges: hero.relic === "reset" ? 1 : 0,
    },
    map: [],
    position: null,
    visited: [],
    floors: 0,
    battle: null,
    learned: [],
    mastery: {},
    answers: [],
    quiz: null,
    reward: null,
    roomDone: false,
    shop: null,
  };
  run.map = makeMap(1, run);
  return run;
}
export function availableNodes(run: Run): MapNode[] {
  if (run.screen !== "map") return [];
  if (!run.position) return run.map.filter((n) => n.row === 0);
  const next = run.map.find((n) => n.id === run.position)?.next ?? [];
  return run.map.filter((n) => next.includes(n.id));
}
export function enterNode(input: Run, id: string): Run {
  const node = availableNodes(input).find((n) => n.id === id);
  if (!node) return input;
  const run = clone(input);
  run.position = id;
  run.visited.push(id);
  run.floors++;
  run.roomDone = false;
  run.screen =
    node.kind === "elite" || node.kind === "boss" ? "combat" : node.kind;
  if (run.screen === "combat") startBattle(run, node);
  if (run.screen === "quiz") startQuiz(run, false);
  if (run.screen === "shop") {
    run.shop = {
      cards: shuffle(run, cardPool(run))
        .slice(0, 3)
        .map((id) => ({
          card: makeCard(run, id),
          price:
            CARD_BY_ID[id].rarity === "rare"
              ? 90
              : CARD_BY_ID[id].rarity === "uncommon"
                ? 65
                : 45,
          sold: false,
        })),
      relic: randomRelic(run),
      relicSold: false,
      removed: false,
    };
  }
  return run;
}

function shuffle<T>(run: Run, list: T[]): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random(run) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function draw(run: Run, count: number): void {
  const battle = run.battle!;
  for (let i = 0; i < count && battle.hand.length < 10; i++) {
    if (!battle.drawPile.length && battle.discard.length) {
      battle.drawPile = shuffle(run, battle.discard);
      battle.discard = [];
    }
    const card = battle.drawPile.pop();
    if (!card) break;
    battle.hand.push(card);
  }
}
function startBattle(run: Run, node: MapNode): void {
  const boss = node.kind === "boss";
  const elite = node.kind === "elite";
  const names = ["幻觉游魂", "注入潜影", "循环之眼"];
  const tier = 1 + Math.floor((run.act - 1) * 2 / (CHAPTER_COUNT - 1));
  const hp = boss
    ? 100 + tier * 40
    : elite
      ? 50 + tier * 20
      : 32 + tier * 8 + node.row * 2;
  const enemy: Enemy = {
    id: `${node.id}-enemy-0`,
    name: boss
      ? CHAPTER_BOSSES[run.act - 1]
      : elite
        ? "噪声监守"
        : names[Math.floor(random(run) * names.length)],
    hp,
    maxHp: hp,
    block: 0,
    damage: boss
      ? 10 + tier * 5
      : elite
        ? 10 + tier * 3
        : 6 + tier * 3,
    pattern: boss
      ? ["attack", "heavy", "attack", "weaken"]
      : ["attack", "attack", "defend", "heavy"],
    weak: 0,
    vulnerable: 0,
    poison: 0,
    art: boss ? "boss" : elite ? "golem" : "wisp",
    trait: !boss && !elite && node.row > 0 ? "rage" : elite ? "shell" : undefined,
    boss: boss ? createBossState(run.act) : undefined,
  };
  if (enemy.name === "注入潜影")
    enemy.pattern = ["weaken", "attack", "heavy", "defend"];
  if (enemy.name === "循环之眼")
    enemy.pattern = ["defend", "attack", "heavy", "attack"];
  const enemies = [enemy];
  if (boss && run.act === 3) enemy.block = 12;
  if (boss && run.act === 10) {
    enemies.push(
      { ...enemy, id: `${node.id}-actor`, name: "议会执行者", hp: 38, maxHp: 38, damage: 9, art: "golem", pattern: ["attack"], boss: { kind: "council", role: "actor" } },
      { ...enemy, id: `${node.id}-auditor`, name: "议会审核者", hp: 30, maxHp: 30, damage: 0, art: "wisp", boss: { kind: "council", role: "auditor" } },
    );
  }
  if (elite && tier > 1)
    enemies.push({
      ...enemy,
      id: `${node.id}-enemy-1`,
      name: "残响游魂",
      hp: 20 + tier * 4,
      maxHp: 20 + tier * 4,
      damage: 4 + tier,
      art: "wisp",
    });
  run.player.block = 0;
  run.player.energy = run.player.maxEnergy;
  run.player.strength = CHARACTERS.find(c => c.id === run.character)!.strength;
  run.player.weak = 0;
  run.player.vulnerable = 0;
  run.battle = {
    turn: 1,
    enemies,
    hand: [],
    drawPile: shuffle(run, run.deck),
    discard: [],
    exhaust: [],
    observed: false,
    cache: 0,
    retention: false,
    log: ["战斗开始。观察敌人意图，选择你的行动。"],
    room: node.kind,
    sequence: [],
    cardsPlayed: 0,
    burstUsed: false,
    ward: run.preparation?.ward,
    review: run.preparation?.review ? "pending" : undefined,
  };
  delete run.preparation;
  run.battle.lab = {
    caseId: caseForBattle(run).id,
    choice: null,
    transfer: null,
    order: shuffle(run,[0,1,2]),
    transferOrder: shuffle(run,[0,1,2]),
  };
  run.encounteredCases = [...(run.encounteredCases ?? []), run.battle.lab.caseId];
  if (run.player.relics.includes("seal")) run.player.block += 3;
  draw(
    run,
    CHARACTERS.find(c => c.id === run.character)!.draw +
      (hasRelic(run, "thread") ? 1 : 0) +
      (run.player.relics.includes("prism") ? 1 : 0),
  );
}
export function enemyIntent(
  enemy: Enemy,
  turn: number,
): { kind: "attack" | "defend" | "weaken" | "heavy"; value: number } {
  const special = bossIntent(enemy, turn);
  if (special) return special;
  const kind = enemy.pattern[(turn - 1) % enemy.pattern.length];
  const base =
    kind === "defend"
      ? 8
      : kind === "weaken"
        ? 2
        : kind === "heavy"
          ? Math.floor(enemy.damage * 1.6)
          : enemy.damage;
  const pressure = enemy.boss?.kind === "window" ? Math.max(0, enemy.boss.used - 4) * 2 : enemy.boss?.kind === "reward" ? enemy.boss.debt * 3 : 0;
  return {
    kind,
    value:
      kind === "attack" || kind === "heavy"
        ? Math.floor((base + pressure) * (enemy.weak > 0 ? 0.75 : 1))
        : base,
  };
}
function hurt(
  target: { hp: number; block: number; vulnerable: number },
  damage: number,
  floor = 0,
): void {
  const amount = Math.max(
    0,
    Math.floor(damage * (target.vulnerable > 0 ? 1.5 : 1)),
  );
  const absorbed = Math.min(target.block, amount);
  target.block -= absorbed;
  target.hp = Math.max(Math.min(target.hp, floor), target.hp - amount + absorbed);
}
function heal(run: Run, amount: number): void {
  run.player.hp = Math.min(run.player.maxHp, run.player.hp + amount);
}
function strikeEnemy(run: Run, enemy: Enemy, amount: number): void {
  const hpBefore = enemy.hp, blockBefore = enemy.block;
  hurt(enemy, amount, bossHpFloor(enemy));
  (run.battle!.attackHits ??= []).push({ targetId: enemy.id,
    damage: hpBefore - enemy.hp, blocked: blockBefore - enemy.block,
    hpBefore, hpAfter: enemy.hp, blockBefore, blockAfter: enemy.block });
}
function damagePlayer(run: Run, amount: number): void {
  if (amount > 0 && run.battle!.ward) {
    run.battle!.ward = false;
    addLog(run, "隔离执行舱：抵消一次敌人攻击，保护已消耗。");
  } else hurt(run.player, amount);
}
function addLog(run: Run, message: string): void {
  run.battle!.log.push(message);
  run.battle!.log = run.battle!.log.slice(-30);
}
function cardPool(run: Run): string[] {
  const lessons = actLessons(run.act).map((l) => l.id);
  return CARDS.filter(
    (c) => c.rarity !== "basic" && canAcquireCard(c.id, run.character, run.act) && lessons.includes(c.lesson),
  ).map((c) => c.id);
}
function makeCard(run: Run, defId: string): Card {
  return {
    uid: `${run.act}-${run.floors}-${Math.floor(random(run) * 0xffffffff).toString(36)}`,
    defId,
    upgraded: false,
  };
}
function rewardVictory(run: Run): void {
  if (run.screen !== "combat" || !run.battle!.enemies.every((e) => e.hp === 0))
    return;
  run.screen = "reward";
  const room = run.battle!.room;
  if (hasRelic(run, "lantern")) heal(run, 6);
  run.reward = {
    cards: shuffle(run, cardPool(run))
      .slice(0, 3)
      .map((id) => makeCard(run, id)),
    gold: room === "boss" ? 80 : room === "elite" ? 50 : 25 + run.act * 5,
    relic: room === "elite" || room === "boss" ? randomRelic(run) : null,
  };
}
function randomRelic(run: Run): RelicId {
  const pool = rewardRelics(run.player.relics);
  return pool[Math.floor(random(run) * pool.length)] ?? "heart";
}
export function combatUnlocked(run: Run): boolean {
  const lab = run.battle?.lab;
  return run.screen === "combat" && !!lab && [lab.choice, lab.transfer].every(n => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 2);
}
export function useReset(input: Run): Run {
  if (!combatUnlocked(input) || !hasRelic(input, "reset") ||
      input.player.resetCharges !== 1 || input.player.hp <= 0 || input.player.hp >= input.player.maxHp) return input;
  const run = clone(input);
  run.player.resetCharges = 0;
  heal(run, run.player.maxHp);
  run.battle!.enemyActions = [];
  run.battle!.attackHits = [];
  addLog(run, "重置：回复全部生命，本幕额度已用完。");
  return run;
}
export function burstBonus(run: Run, card: Card): number {
  const def = statsFor(card);
  return def.damage && def.cost >= 2 && hasRelic(run, "anvil") && run.battle && !run.battle.burstUsed ? 8 : 0;
}
export function takeBossBait(input: Run): Run {
  if (!combatUnlocked(input) || !input.battle?.enemies.some(e => e.hp > 0 && e.boss?.kind === "reward" && !e.boss.claimed)) return input;
  const run = clone(input);
  const enemy = run.battle!.enemies.find(e => e.hp > 0 && e.boss?.kind === "reward")!;
  if (enemy.boss?.kind !== "reward") return input;
  enemy.boss.claimed = true;
  enemy.boss.debt++;
  enemy.hp = Math.min(enemy.maxHp, enemy.hp + 20);
  run.player.energy += 2;
  run.battle!.enemyActions = [];
  run.battle!.attackHits = [];
  addLog(run, "领取诱饵：能量 +2；首领回复 20 生命，所有后续攻击 +3。");
  return run;
}
export function playCard(input: Run, uid: string, targetId?: string): Run {
  if (!combatUnlocked(input) || !input.battle) return input;
  const card = input.battle.hand.find((c) => c.uid === uid);
  if (!card || !isCardForCharacter(card.defId, input.character)) return input;
  const d = statsFor(card);
  if (d.cost > input.player.energy) return input;
  const needsTarget = d.damage || d.weak || d.vulnerable || d.poison;
  const target = input.battle.enemies.find(
    (e) => e.id === targetId && e.hp > 0,
  );
  if (needsTarget && !target) return input;
  const synergy = synergyFor(input, card);
  const run = clone(input);
  const battle = run.battle!;
  battle.enemyActions = [];
  battle.attackHits = [];
  const p = run.player;
  const enemy = battle.enemies.find((e) => e.id === targetId)!;
  const hpBefore = new Map(battle.enemies.map(e => [e.id, e.hp]));
  p.energy -= d.cost;
  battle.hand = battle.hand.filter((c) => c.uid !== uid);
  if (!run.learned.includes(d.lesson)) run.learned.push(d.lesson);
  const bossDraw = beforeBossCard(run, d);
  if (d.damage) {
    const burst = burstBonus(input, card);
    if (burst) {
      battle.burstUsed = true;
      addLog(run, "秩序砧石：重击伤害 +8。");
    }
    const amount = Math.floor(
      (d.damage + p.strength + synergy.damage + burst) * (p.weak > 0 ? 0.75 : 1),
    );
    for (let hit = 0; hit < (d.hits ?? (d.special === "echo" ? 2 : 1)) && enemy.hp > 0; hit++) strikeEnemy(run, enemy, bossCardDamage(run, enemy, d, amount));
  }
  p.block += (d.block ?? 0) + synergy.block;
  p.energy += (d.energy ?? 0) + synergy.energy;
  if (d.strength) p.strength += d.strength;
  if (d.heal) heal(run, d.heal);
  if (d.special === "reset") heal(run, p.maxHp);
  if (d.weak) enemy.weak += d.weak;
  if (d.vulnerable) enemy.vulnerable += d.vulnerable;
  if (d.poison) enemy.poison += d.poison;
  if (card.defId === "observe") battle.observed = true;
  if (d.special === "cache") battle.cache++;
  if (d.special === "retention") battle.retention = true;
  if (d.special === "cleanse") {
    p.weak = 0;
    p.vulnerable = 0;
  }
  // Draw before discarding the played card: it cannot immediately draw itself.
  if (d.draw || synergy.draw || bossDraw) draw(run, (d.draw ?? 0) + synergy.draw + bossDraw);
  battle.cardsPlayed = (battle.cardsPlayed ?? 0) + 1;
  if (hasRelic(run, "thread") && battle.cardsPlayed % 3 === 0) {
    draw(run, 1);
    addLog(run, "记忆丝线：三牌连奏，额外抽 1 张。");
  }
  battle.sequence = [...(battle.sequence ?? []), d.id].slice(-30);
  if (synergy.label) addLog(run, `${synergy.label}：${synergy.explanation}`);
  if (d.exhaust || d.type === "power") battle.exhaust.push(card);
  else battle.discard.push(card);
  if (d.purge) run.deck = run.deck.filter(c => c.uid !== card.uid);
  const counter = afterBossCard(run, d, hpBefore);
  if (counter) {
    const hp = p.hp, block = p.block;
    damagePlayer(run, counter);
    const attacker = battle.enemies.find(e => e.hp > 0 && e.boss?.kind === "recovery")!;
    battle.enemyActions!.push({ enemyId: attacker.id, kind: "attack", value: counter,
      damage: hp - p.hp, blocked: block - p.block });
    addLog(run, `原样重试：首领反击 ${counter} 点。`);
  }
  addLog(
    run,
    `打出「${d.name}${card.upgraded ? "+" : ""}」${target ? ` → ${target.name}` : ""}。`,
  );
  if (!p.hp) run.screen = "defeat";
  else rewardVictory(run);
  return run;
}
export function endTurn(input: Run): Run {
  if (!combatUnlocked(input) || !input.battle) return input;
  const run = clone(input);
  const b = run.battle!;
  const p = run.player;
  b.enemyActions = [];
  b.attackHits = [];
  b.discard.push(...b.hand.filter(c => !statsFor(c).retain));
  b.hand = b.hand.filter(c => statsFor(c).retain);
  p.weak = Math.max(0, p.weak - 1);
  p.vulnerable = Math.max(0, p.vulnerable - 1);
  for (const enemy of b.enemies.filter((e) => e.hp > 0)) {
    enemy.block = 0;
    if (enemy.poison) {
      enemy.hp = Math.max(bossHpFloor(enemy), enemy.hp - enemy.poison);
      enemy.poison--;
    }
    if (!enemy.hp) continue;
    const intent = enemyIntent(enemy, b.turn);
    const hpBefore = p.hp;
    const blockBefore = p.block;
    if (intent.kind === "defend") {
      enemy.block = intent.value;
      if (enemy.boss?.kind === "council" && enemy.boss.role === "auditor") {
        for (const ally of b.enemies.filter(e => e.hp > 0 && e.id !== enemy.id)) ally.block += intent.value;
      }
      addLog(run, `${enemy.name} 获得 ${intent.value} 点格挡。`);
    } else if (intent.kind === "weaken") {
      p.weak += intent.value;
      addLog(run, `${enemy.name} 施加 ${intent.value} 层虚弱。`);
    } else {
      damagePlayer(run, intent.value);
      addLog(run, `${enemy.name} 发动 ${intent.value} 点攻击。`);
    }
    b.enemyActions.push({ enemyId: enemy.id, ...intent, damage: hpBefore - p.hp, blocked: blockBefore - p.block });
    enemy.weak = Math.max(0, enemy.weak - 1);
    enemy.vulnerable = Math.max(0, enemy.vulnerable - 1);
    if (enemy.trait === "rage") enemy.damage++;
    if (enemy.trait === "shell") enemy.block += 4;
    bossTurnEnd(enemy);
    if (!p.hp) {
      run.screen = "defeat";
      return run;
    }
  }
  rewardVictory(run);
  if (run.screen === "reward") return run;
  const sandboxBlock = b.turn % 2 && b.enemies.some(e => e.hp > 0 && e.boss?.kind === "boundary") ? Math.min(p.block, 16) : 0;
  b.turn++;
  b.sequence = [];
  b.cardsPlayed = 0;
  b.burstUsed = false;
  b.observed = false;
  p.block =
    Math.max(sandboxBlock, b.retention ? Math.min(p.block, 8) : 0) +
    (p.relics.includes("seal") ? 3 : 0);
  p.energy = p.maxEnergy + b.cache;
  draw(run, CHARACTERS.find(c => c.id === run.character)!.draw + (p.relics.includes("prism") ? 1 : 0));
  addLog(run, `第 ${b.turn} 回合：恢复能量，抽取新手牌。`);
  return run;
}
export function answerLab(input: Run, choice: number): Run {
  if (
    input.screen !== "combat" ||
    !input.battle ||
    !Number.isInteger(choice) ||
    choice < 0 ||
    choice > 2
  )
    return input;
  const scenario = caseForBattle(input);
  const old = input.battle.lab;
  if (old?.transfer !== null && old?.transfer !== undefined) return input;
  const run = clone(input);
  const lab = (run.battle!.lab ??= {
    caseId: scenario.id,
    choice: null,
    transfer: null,
  });
  run.battle!.enemyActions = [];
  run.battle!.attackHits = [];
  if (lab.choice === null) {
    lab.choice = choice;
    if (choice === scenario.correct) {
      run.player.energy++;
      draw(run, 1);
    } else run.player.weak++;
    if (!run.learned.includes(scenario.lesson))
      run.learned.push(scenario.lesson);
    addLog(run, scenario.consequences[choice]);
  } else {
    lab.transfer = choice;
    if (
      lab.choice === scenario.correct &&
      choice === transferFor(scenario).correct
    ) {
      run.mastery[scenario.lesson] = Math.min(
        3,
        (run.mastery[scenario.lesson] ?? 0) + 1,
      );
      run.player.block += 6;
      run.player.gold += 10;
      addLog(run, "情境与原理均验证：获得 6 格挡、10 金币与掌握度。");
    }
    if (run.battle!.review === "pending") {
      const passed = lab.choice === scenario.correct && choice === transferFor(scenario).correct;
      run.battle!.review = passed ? "passed" : "failed";
      if (passed) { run.player.gold += 60; heal(run, 10); }
      addLog(run, passed ? "固定种子复测通过：额外获得 60 金币并回复 10 生命。" : "固定种子复测未通过：押注预算不返还。");
    }
  }
  return run;
}
export function usePotion(input: Run, index: number, targetId?: string): Run {
  if (!combatUnlocked(input) || !input.battle || !Number.isInteger(index))
    return input;
  const potion = input.player.potions[index];
  if (!potion) return input;
  const target = input.battle.enemies.find(
    (e) => e.id === targetId && e.hp > 0,
  );
  if (potion === "fire" && !target) return input;
  const run = clone(input);
  run.battle!.enemyActions = [];
  run.battle!.attackHits = [];
  run.player.potions.splice(index, 1);
  if (potion === "heal") heal(run, 20);
  if (potion === "energy") run.player.energy += 2;
  if (potion === "fire") {
    const enemy = run.battle!.enemies.find((e) => e.id === targetId)!;
    strikeEnemy(run, enemy, 20);
  }
  addLog(run, "使用了一瓶药水。");
  rewardVictory(run);
  return run;
}
function addRelic(run: Run, id: RelicId): void {
  if (!isRelicForCharacter(id, run.character)) return;
  if (run.player.relics.includes(id)) {
    run.player.gold += 35;
    return;
  }
  run.player.relics.push(id);
  if (id === "battery") run.player.maxEnergy++;
  if (id === "heart") {
    run.player.maxHp += 12;
    heal(run, 12);
  }
}
function toMap(run: Run): Run {
  run.screen = "map";
  run.roomDone = true;
  run.reward = null;
  run.quiz = null;
  run.shop = null;
  return run;
}
function startQuiz(run: Run, boss: boolean): void {
  const node = run.map.find(n => n.id === run.position);
  const chapter = node ? LESSON_BY_ID[node.lessonId].chapter : chapterForRow(run.act, 0);
  const matching = TRIALS.filter(t => t.questions.every(q => q.chapter === chapter));
  const remaining = matching.filter(t => !run.completedTrials?.includes(t.id));
  const pool = remaining.length ? remaining : matching;
  const trial = pool[Math.floor(random(run) * pool.length)];
  const order = shuffle(run, trial.questions.map((_,i) => i)).slice(0,3);
  const optionOrders = order.map(() => shuffle(run, [0,1,2]));
  run.screen = "quiz";
  run.quiz = { lessonId: trial.questions[order[0]].lessonId, selected: null, correct: null, boss,
    trial: { id: trial.id, step: 0, answers: [], reward: null, order, optionOrders, revision: 3 } };
}
export function chooseReward(input: Run, uid: string | null): Run {
  if (input.screen !== "reward" || !input.reward) return input;
  if (input.reward.relic && !isRelicForCharacter(input.reward.relic, input.character)) return input;
  const picked = input.reward.cards.find((c) => c.uid === uid);
  if (uid !== null && (!picked || !canAcquireCard(picked.defId, input.character, input.act))) return input;
  const run = clone(input);
  if (picked) run.deck.push(picked);
  run.player.gold += run.reward!.gold;
  if (run.reward!.relic) addRelic(run, run.reward!.relic);
  run.reward = null;
  if (run.battle?.room === "boss") startQuiz(run, true);
  else toMap(run);
  return run;
}
export function answerQuiz(input: Run, index: number): Run {
  if (input.screen !== "quiz" || !input.quiz || input.quiz.selected !== null)
    return input;
  const lesson = trialQuestion(input.quiz);
  if (!Number.isInteger(index) || index < 0 || index >= lesson.options.length)
    return input;
  const run = clone(input);
  const q = run.quiz!;
  q.selected = index;
  q.correct = lesson.correct === index;
  run.answers.push({ lessonId: lesson.lessonId, correct: q.correct });
  if (!run.learned.includes(lesson.lessonId)) run.learned.push(lesson.lessonId);
  if (q.correct) {
    run.mastery[lesson.lessonId] = Math.min(3, (run.mastery[lesson.lessonId] ?? 0) + 1);
    if (!q.trial) { run.player.gold += 25; heal(run, 5); }
  }
  if (q.trial) {
    q.trial.answers.push(index);
    if (q.trial.step === 2)
      q.trial.reward = trialReward(run);
  }
  return run;
}
export function finishQuiz(input: Run): Run {
  if (input.screen !== "quiz" || !input.quiz || input.quiz.selected === null)
    return input;
  const run = clone(input);
  const trial = run.quiz!.trial;
  if (trial) {
    if (trial.reward?.relic && !isRelicForCharacter(trial.reward.relic, run.character)) return input;
    if (trial.step < 2) {
      trial.step++;
      run.quiz!.lessonId = trialQuestion(run.quiz!).lessonId;
      run.quiz!.selected = null;
      run.quiz!.correct = null;
      return run;
    }
    if (!trial.reward) return input;
    run.player.gold += trial.reward.gold;
    heal(run, trial.reward.heal);
    if (trial.reward.relic) addRelic(run, trial.reward.relic);
    if (trial.reward.potion) run.player.potions.push(trial.reward.potion);
    run.completedTrials = [...new Set([...(run.completedTrials ?? []), trial.id])];
  }
  if (run.quiz!.boss) {
    if (run.act === CHAPTER_COUNT) {
      run.screen = "victory";
      run.quiz = null;
      return run;
    }
    run.act++;
    if (hasRelic(run, "reset")) {
      if (run.player.resetCharges === 1 && !run.deck.some(c => c.defId === "banked-reset"))
        run.deck.push(makeCard(run, "banked-reset"));
      run.player.resetCharges = 1;
    }
    run.map = makeMap(run.act, run);
    run.position = null;
    run.visited = [];
    run.battle = null;
    heal(run, Math.ceil(run.player.maxHp * 0.2));
    if (run.player.potions.length < 3) run.player.potions.push("fire");
  }
  return toMap(run);
}
export function rest(
  input: Run,
  choice: "heal" | "upgrade",
  uid?: string,
): Run {
  if (input.screen !== "rest" || input.roomDone) return input;
  const card = input.deck.find((c) => c.uid === uid && !c.upgraded && isCardForCharacter(c.defId, input.character));
  if (choice === "upgrade" && !card) return input;
  const run = clone(input);
  if (choice === "heal") heal(run, Math.ceil(run.player.maxHp * 0.3));
  else run.deck.find((c) => c.uid === uid)!.upgraded = true;
  return toMap(run);
}
export function buy(input: Run, item: string, uid?: string): Run {
  if (input.screen !== "shop" || !input.shop) return input;
  const offer = input.shop.cards.find((o) => o.card.uid === item && !o.sold);
  if (offer && !canAcquireCard(offer.card.defId, input.character, input.act)) return input;
  const remove =
    item === "remove" &&
    !input.shop.removed &&
    input.deck.length > 5 &&
    input.deck.some((c) => c.uid === uid);
  const relic = item === "relic" && !input.shop.relicSold;
  if (relic && !isRelicForCharacter(input.shop.relic, input.character)) return input;
  const potion = item === "potion" && input.player.potions.length < 3;
  if (!offer && !remove && !relic && !potion) return input;
  const price = offer?.price ?? (remove ? 50 : relic ? 125 : 30);
  if (input.player.gold < price) return input;
  const run = clone(input);
  run.player.gold -= price;
  if (offer) {
    run.deck.push(offer.card);
    run.shop!.cards.find((o) => o.card.uid === item)!.sold = true;
  }
  if (remove) {
    run.deck = run.deck.filter((c) => c.uid !== uid);
    run.shop!.removed = true;
  }
  if (relic) {
    addRelic(run, run.shop!.relic);
    run.shop!.relicSold = true;
  }
  if (potion) run.player.potions.push("heal");
  return run;
}
export function leaveRoom(input: Run): Run {
  if (input.screen !== "shop") return input;
  return toMap(clone(input));
}
export function claimTreasure(input: Run): Run {
  if (input.screen !== "treasure" || input.roomDone) return input;
  const run = clone(input);
  addRelic(run, randomRelic(run));
  run.player.gold += 25;
  return toMap(run);
}
export function resolveEvent(
  input: Run,
  choice: "study" | "risk" | "leave",
  uid?: string,
): Run {
  if (input.screen !== "event" || input.roomDone || !["study", "risk", "leave"].includes(choice)) return input;
  const view = eventView(input);
  const selected = view.targets.find(c => c.uid === uid);
  if (choice === "risk" && (view.disabled || (view.targeted && !selected))) return input;
  const run = clone(input);
  if (choice === "study") {
    startQuiz(run, false);
    return run;
  }
  if (choice === "risk") {
    run.player.gold -= view.cost;
    switch (run.act) {
      case 1: run.player.hp = Math.max(0, run.player.hp - 8); run.player.gold += 45; break;
      case 2: run.deck = run.deck.filter(c => c.uid !== uid); break;
      case 3: run.deck.push(makeCard(run, selected!.defId)); break;
      case 4: run.deck.find(c => c.uid === uid)!.upgraded = true; break;
      case 5: run.deck.find(c => c.uid === uid)!.upgraded = false; run.player.gold += 65; break;
      case 6: run.player.hp = Math.max(0, run.player.hp - 10); run.preparation = { ...run.preparation, ward: true }; break;
      case 7: run.preparation = { ...run.preparation, review: true }; break;
      case 8: run.player.maxHp -= 12; run.player.hp = Math.min(run.player.hp, run.player.maxHp); run.player.gold += 90; break;
      case 9: {
        const copy = run.deck.find(c => c.uid !== uid && c.defId === selected!.defId && !c.upgraded)!;
        run.deck = run.deck.filter(c => c.uid !== copy.uid);
        run.deck.find(c => c.uid === uid)!.upgraded = true;
        break;
      }
      case 10: {
        const first = run.player.potions.shift()!;
        const other = run.player.potions.findIndex(p => p !== first);
        run.player.potions.splice(other, 1);
        addRelic(run, view.relic!);
        break;
      }
    }
    if (run.player.hp === 0) {
      run.screen = "defeat";
      return run;
    }
  }
  return toMap(run);
}
