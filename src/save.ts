import { restoreCurriculum } from "./curriculum";
import { restoreBeginnerLearning } from "./beginner-migration";
import { BEGINNER_BY_ID } from "./beginner-content";
import { restoreCharacterOwnership } from "./ownership";
import type { Run } from "./engine";
import { CARD_BY_ID, CHARACTERS, RELICS, type RelicId } from "./cards";
import { LESSON_BY_ID, CHAPTER_COUNT } from "./content";
import { CASE_BY_ID } from "./learning-cases";
import { TRIAL_BY_ID, trialDefinition, trialReward, trialQuestion, trialScore } from "./trials";
import { createBossState } from "./boss-mechanics";
export const encodeRun = (run: Run): string => JSON.stringify(run);
type Obj = Record<string, unknown>;
const object = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, max = Number.MAX_SAFE_INTEGER): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= max;
const str = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const array = (v: unknown, check: (x: unknown) => boolean): boolean =>
  Array.isArray(v) && v.length < 10000 && v.every(check);
const card = (v: unknown): boolean =>
  object(v) &&
  str(v.uid) &&
  str(v.defId) &&
  Object.hasOwn(CARD_BY_ID, v.defId) &&
  typeof v.upgraded === "boolean";
const lesson = (v: unknown): boolean =>
  str(v) && Object.hasOwn(LESSON_BY_ID, v);
const relic = (v: unknown): boolean => str(v) && Object.hasOwn(RELICS, v);
const kinds = [
  "combat",
  "elite",
  "boss",
  "quiz",
  "rest",
  "shop",
  "event",
  "treasure",
];
function bossState(v: unknown, chapter: number): boolean {
  if (!object(v) || v.kind !== createBossState(chapter)?.kind) return false;
  const cardId = (id: unknown) => id === null || (str(id) && Object.hasOwn(CARD_BY_ID, id));
  switch (v.kind) {
    case "feedback": return typeof v.ready === "boolean";
    case "window": return num(v.used);
    case "retrieval": return array(v.known, id => id !== null && cardId(id)) && new Set(v.known as unknown[]).size === (v.known as unknown[]).length && typeof v.recalled === "boolean";
    case "protocol": return num(v.step, 2);
    case "recovery": return cardId(v.lastCard);
    case "boundary": return true;
    case "evaluation": return num(v.streak, 2) && typeof v.attacked === "boolean" && typeof v.defended === "boolean";
    case "reward": return typeof v.claimed === "boolean" && num(v.debt);
    case "evolution": return cardId(v.resisted) && cardId(v.candidate) && num(v.peak);
    case "council": return ["coordinator", "actor", "auditor"].includes(String(v.role));
    default: return false;
  }
}
function valid(value: unknown): value is Run {
  if (
    !object(value) ||
    value.version !== 1 ||
    !num(value.seed, 0xffffffff) ||
    !num(value.rng, 0xffffffff) ||
    !CHARACTERS.some((c) => c.id === value.character) ||
    !num(value.act, CHAPTER_COUNT) ||
    value.act < 1 ||
    ![
      "combat",
      "quiz",
      "rest",
      "shop",
      "event",
      "treasure",
      "map",
      "reward",
      "victory",
      "defeat",
    ].includes(String(value.screen)) ||
    typeof value.roomDone !== "boolean" ||
    !num(value.floors) ||
    !array(value.deck, card) ||
    !object(value.player)
  )
    return false;
  if (value.curriculumVersion !== undefined && value.curriculumVersion !== 2) return false;
  if (value.preparation !== undefined && (!object(value.preparation) ||
    Object.keys(value.preparation).some(k => !["ward", "review"].includes(k)) ||
    [value.preparation.ward, value.preparation.review].some(v => v !== undefined && typeof v !== "boolean"))) return false;
  const p = value.player;
  if (p.resetCharges !== undefined && !num(p.resetCharges, 1)) return false;
  if (
    ![
      "hp",
      "maxHp",
      "energy",
      "maxEnergy",
      "block",
      "gold",
      "strength",
      "weak",
      "vulnerable",
    ].every((k) => num(p[k])) ||
    (p.hp as number) > (p.maxHp as number) ||
    (p.maxHp as number) < 1 ||
    !array(p.relics, relic) ||
    !array(p.potions, (x) => ["heal", "energy", "fire"].includes(String(x)))
  )
    return false;
  if (
    !array(
      value.map,
      (v) =>
        object(v) &&
        str(v.id) &&
        num(v.row, 8) &&
        num(v.col, 2) &&
        kinds.includes(String(v.kind)) &&
        array(v.next, str) &&
        lesson(v.lessonId),
    ) ||
    !Array.isArray(value.map) ||
    !value.map.length
  )
    return false;
  const ids = new Set(value.map.map((v) => (v as Obj).id));
  if (
    ids.size !== value.map.length ||
    !value.map.every((v) =>
      ((v as Obj).next as unknown[]).every((id) => ids.has(id)),
    ) ||
    (value.position !== null && !ids.has(value.position)) ||
    !array(value.visited, (id) => ids.has(id))
  )
    return false;
  if (
    !array(value.learned, lesson) ||
    !object(value.mastery) ||
    !Object.entries(value.mastery).every(
      ([id, n]) => lesson(id) && num(n, 3),
    ) ||
    !array(
      value.answers,
      (v) => object(v) && lesson(v.lessonId) && typeof v.correct === "boolean",
    )
  )
    return false;
  if (value.battle !== null) {
    const b = value.battle;
    if (object(b) && ((b.cardsPlayed !== undefined && !num(b.cardsPlayed)) ||
        (b.burstUsed !== undefined && typeof b.burstUsed !== "boolean"))) return false;
    if (
      !object(b) ||
      !num(b.turn) ||
      b.turn < 1 ||
      !num(b.cache) ||
      typeof b.retention !== "boolean" ||
      typeof b.observed !== "boolean" ||
      !kinds.includes(String(b.room)) ||
      !array(b.log, str) ||
      !["hand", "drawPile", "discard", "exhaust"].every((k) =>
        array(b[k], card),
      ) ||
      !Array.isArray(b.enemies) ||
      !b.enemies.length ||
      !array(
        b.enemies,
        (e) =>
          object(e) &&
          str(e.id) &&
          str(e.name) &&
          str(e.art) &&
          [
            "hp",
            "maxHp",
            "damage",
            "block",
            "weak",
            "vulnerable",
            "poison",
          ].every((k) => num(e[k])) &&
          Array.isArray(e.pattern) &&
          e.pattern.length > 0 &&
          e.pattern.every((x) =>
            ["attack", "defend", "weaken", "heavy"].includes(String(x)),
          ),
      )
    )
      return false;
    if (b.ward !== undefined && typeof b.ward !== "boolean") return false;
    if (b.review !== undefined && !["pending", "passed", "failed"].includes(String(b.review))) return false;
    const enemies = b.enemies as Obj[];
    if (enemies.some(e => e.boss !== undefined && (value.curriculumVersion !== 2 || b.room !== "boss" || !bossState(e.boss, value.act as number)))) return false;
    if (enemies.some(e => object(e.boss) && e.boss.kind === "council") &&
      (enemies.length !== 3 || new Set(enemies.map(e => object(e.boss) ? e.boss.role : null)).size !== 3 || enemies.some(e => !object(e.boss) || e.boss.kind !== "council"))) return false;
    if (
      b.sequence !== undefined &&
      !array(b.sequence, (id) => str(id) && Object.hasOwn(CARD_BY_ID, id))
    )
      return false;
    if (b.enemyActions !== undefined && !array(b.enemyActions, a =>
      object(a) && str(a.enemyId) && (b.enemies as Obj[]).some(e => e.id === a.enemyId) &&
      ["attack", "defend", "weaken", "heavy"].includes(String(a.kind)) &&
      ["value", "damage", "blocked"].every(k => num(a[k])))) return false;
    if (b.attackHits !== undefined && (!Array.isArray(b.attackHits) || b.attackHits.length > 12 || !b.attackHits.every(h =>
      object(h) && str(h.targetId) && enemies.some(e => e.id === h.targetId) &&
      ["damage", "blocked", "hpBefore", "hpAfter", "blockBefore", "blockAfter"].every(k => num(h[k])) &&
      (h.hpBefore as number) - (h.hpAfter as number) === h.damage &&
      (h.blockBefore as number) - (h.blockAfter as number) === h.blocked))) return false;
    if (
      b.lab !== undefined &&
      (!object(b.lab) ||
        !str(b.lab.caseId) ||
        !Object.hasOwn(CASE_BY_ID, b.lab.caseId) ||
        ![b.lab.choice, b.lab.transfer].every((n) => n === null || num(n, 2)) ||
        (b.lab.choice === null && b.lab.transfer !== null))
    )
      return false;
    if (object(b.lab) && [b.lab.order,b.lab.transferOrder].some(order => order !== undefined &&
      (!Array.isArray(order) || order.length !== 3 || !order.every(i=>num(i,2)) || new Set(order).size !== 3))) return false;
    if (object(b.lab) && b.lab.beginnerTransfer !== undefined &&
      (typeof b.lab.beginnerTransfer !== "boolean" || (b.lab.beginnerTransfer &&
        (b.lab.choice === null || CASE_BY_ID[String(b.lab.caseId)].level === "beginner")))) return false;
    if (object(b.lab) && b.lab.followUpVersion !== undefined && b.lab.followUpVersion !== 1) return false;
    if (
      !(b.enemies as Obj[]).every(
        (e) =>
          e.trait === undefined || ["rage", "shell"].includes(String(e.trait)),
      )
    )
      return false;
  }
  if (
    value.quiz !== null &&
    (!object(value.quiz) ||
      !lesson(value.quiz.lessonId) ||
      typeof value.quiz.boss !== "boolean" ||
      !(value.quiz.selected === null || num(value.quiz.selected, 2)) ||
      !(value.quiz.correct === null || typeof value.quiz.correct === "boolean"))
  )
    return false;
  if (value.completedTrials !== undefined && !array(value.completedTrials, id => str(id) && Object.hasOwn(TRIAL_BY_ID, id))) return false;
  if (object(value.quiz) && value.quiz.beginnerQuestion !== undefined &&
    (value.quiz.trial !== undefined || !str(value.quiz.beginnerQuestion) || !Object.hasOwn(BEGINNER_BY_ID,value.quiz.beginnerQuestion) ||
      BEGINNER_BY_ID[value.quiz.beginnerQuestion].lessonId !== value.quiz.lessonId)) return false;
  if (value.encounteredCases !== undefined && !array(value.encounteredCases, id => str(id) && Object.hasOwn(CASE_BY_ID,id))) return false;
  if (object(value.quiz) && value.quiz.trial !== undefined) {
    const q = value.quiz, t = q.trial;
    if (!object(t) || !str(t.id) || !Object.hasOwn(TRIAL_BY_ID, t.id) || !num(t.step, 2) ||
      !(t.revision === undefined || t.revision === 1 || t.revision === 2 || t.revision === 3) ||
      !array(t.answers, a => num(a, 2)) || !Array.isArray(t.answers) ||
      t.answers.length !== t.step + (q.selected === null ? 0 : 1) ||
      (q.selected === null ? q.correct !== null : t.answers.at(-1) !== q.selected)) return false;
    const definition = trialDefinition(q as unknown as NonNullable<Run["quiz"]>);
    if (!definition) return false;
    if (t.introOverrides !== undefined && (t.revision === 3 || !Array.isArray(t.introOverrides) || t.introOverrides.length !== 3 ||
      !t.introOverrides.every(id => id === null || (str(id) && Object.hasOwn(BEGINNER_BY_ID,id) && BEGINNER_BY_ID[id].chapter === value.act)))) return false;
    if (t.order !== undefined && (!array(t.order, i => num(i,definition.questions.length-1)) || !Array.isArray(t.order) || t.order.length !== 3 || new Set(t.order).size !== 3)) return false;
    if (t.optionOrders !== undefined && (!Array.isArray(t.optionOrders) || t.optionOrders.length !== 3 || !t.optionOrders.every(order => Array.isArray(order) && order.length === 3 && order.every(i => num(i,2)) && new Set(order).size === 3))) return false;
    const typed = value as unknown as Run;
    const question = trialQuestion(typed.quiz!);
    if (q.lessonId !== question.lessonId || (q.selected !== null && q.correct !== (q.selected === question.correct))) return false;
    const expected = t.step === 2 && q.selected !== null ? trialReward(typed) : null;
    const reward = t.reward;
    if (expected === null) {
      if (reward !== null) return false;
    } else {
      // Accept only the exact former reward calculation, then migrate after validation.
      const legacyRelic = (["prism", "battery", "seal", "heart", "thread", "anvil", "lantern"] as RelicId[]).find(id => !typed.player.relics.includes(id)) ?? null;
      const legacy = trialScore(typed.quiz!) === 3 ? { gold: legacyRelic ? 140 : 200, heal: 12, relic: legacyRelic, potion: null } : expected;
      const matches = (candidate: typeof expected) => object(reward) &&
        (["gold", "heal", "relic", "potion"] as const).every(k => reward[k] === candidate[k]);
      if (!matches(expected) && !matches(legacy)) return false;
    }
  }
  if (
    value.reward !== null &&
    (!object(value.reward) ||
      !array(value.reward.cards, card) ||
      !num(value.reward.gold) ||
      !(value.reward.relic === null || relic(value.reward.relic)))
  )
    return false;
  if (
    value.shop !== null &&
    (!object(value.shop) ||
      !relic(value.shop.relic) ||
      typeof value.shop.relicSold !== "boolean" ||
      typeof value.shop.removed !== "boolean" ||
      !array(
        value.shop.cards,
        (o) =>
          object(o) &&
          card(o.card) &&
          num(o.price) &&
          typeof o.sold === "boolean",
      ))
  )
    return false;
  if (value.curriculumVersion === 2) {
    if (!(value.map as unknown as Run["map"]).every(n => LESSON_BY_ID[n.lessonId].chapter === value.act)) return false;
    const typed = value as unknown as Run;
    if (typed.quiz && LESSON_BY_ID[typed.quiz.lessonId].chapter !== typed.act) return false;
    if (typed.battle?.lab && CASE_BY_ID[typed.battle.lab.caseId] && LESSON_BY_ID[CASE_BY_ID[typed.battle.lab.caseId].lesson].chapter !== typed.act) return false;
  }
  return !(
    (value.screen === "combat" && value.battle === null) ||
    (value.screen === "quiz" && value.quiz === null) ||
    (value.screen === "reward" && value.reward === null) ||
    (value.screen === "shop" && value.shop === null)
  );
}
export function decodeRun(raw: string): Run | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!valid(value)) return null;
    restoreCurriculum(value);
    restoreBeginnerLearning(value);
    restoreCharacterOwnership(value);
    return value;
  } catch {
    return null;
  }
}
