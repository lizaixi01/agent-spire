import { describe, expect, it } from "vitest";
import { actLessons, CHAPTERS, LESSON_BY_ID } from "../src/content";
import { CARD_BY_ID } from "../src/cards";
import { availableNodes, createRun, enterNode, finishQuiz, type Run } from "../src/engine";
import { caseForBattle } from "../src/learning-cases";
import { decodeRun, encodeRun } from "../src/save";
import { trialQuestion, trialQuestionAt } from "../src/trials";

function finishChapter(run: Run): Run {
  return finishQuiz({ ...run, screen: "quiz", quiz: { lessonId: actLessons(run.act)[0].id, selected: 0, correct: false, boss: true } });
}

describe("十章十幕，教学与新奖励不跨章", () => {
  it("逐幕地图、工程案例、试炼、新卡奖励均只引用本章，第十幕才结束", () => {
    for (const hero of ["scholar", "engineer", "weaver"] as const) {
      let run = createRun(hero, 42);
      for (let chapter = 1; chapter <= 10; chapter++) {
        expect(run.act).toBe(chapter);
        expect(run.screen).toBe("map");
        expect(new Set(actLessons(chapter).map(l => l.chapter))).toEqual(new Set([chapter]));
        for (const node of run.map) expect(LESSON_BY_ID[node.lessonId].chapter).toBe(chapter);
        const battle = enterNode(run, availableNodes(run)[0].id);
        expect(LESSON_BY_ID[caseForBattle(battle).lesson].chapter).toBe(chapter);
        expect(decodeRun(encodeRun(battle))).toEqual(battle);
        for (const room of ["quiz", "shop"] as const) {
          const fixture = structuredClone(run);
          const node = availableNodes(fixture)[0]; node.kind = room;
          const entered = enterNode(fixture, node.id);
          if (room === "quiz") {
            expect(trialQuestion(entered.quiz!).chapter).toBe(chapter);
            for (let step = 0; step < 3; step++) expect(trialQuestionAt(entered.quiz!, step).chapter).toBe(chapter);
          }
          else {
            expect(entered.shop!.cards).toHaveLength(3);
            for (const offer of entered.shop!.cards) {
              const def = CARD_BY_ID[offer.card.defId];
              expect(LESSON_BY_ID[def.lesson].chapter).toBe(chapter);
              expect([undefined, hero]).toContain(def.character);
            }
          }
        }
        const oldDeck = run.deck.map(c => c.uid);
        run = finishChapter(run);
        expect(oldDeck.every(uid => run.deck.some(c => c.uid === uid))).toBe(true);
        expect(decodeRun(encodeRun(run))).toEqual(run);
      }
      expect(run.screen).toBe("victory");
      expect(CHAPTERS).toHaveLength(10);
    }
  });

  it("旧三幕存档按当前正在学习的章恢复，统一未完成地图且不丢远征与知识", () => {
    const old = createRun("scholar", 42);
    delete old.curriculumVersion;
    const node = availableNodes(old)[0]; node.lessonId = "memory";
    const battle = enterNode(old, node.id);
    const restored = decodeRun(encodeRun(battle))!;
    expect(restored).not.toBeNull();
    expect(restored.act).toBe(3);
    expect(restored.curriculumVersion).toBe(2);
    expect(new Set(restored.map.map(n => LESSON_BY_ID[n.lessonId].chapter))).toEqual(new Set([3]));
    expect(restored.battle).toEqual(battle.battle);
    expect(restored.position).toBe(battle.position);
    expect(restored.visited).toEqual(battle.visited);
    expect(restored.learned).toEqual(battle.learned);
    expect(restored.rng).toBe(battle.rng);
    expect(decodeRun(encodeRun(restored))).toEqual(restored);
    expect(finishChapter(restored).act).toBe(4);
  });

  it("新十幕存档不能混入其他章的地图、决策或试炼；旧牌仍能保留", () => {
    const base = createRun("engineer", 42);
    base.deck.push({ uid: "old-owned", defId: "meteor", upgraded: true });
    expect(decodeRun(encodeRun(base))).toEqual(base);
    const mixed = structuredClone(base);
    mixed.map[0].lessonId = "memory";
    expect(decodeRun(encodeRun(mixed))).toBeNull();
    const combat = enterNode(base, availableNodes(base)[0].id);
    combat.battle!.lab = { caseId: "memory-conflict", choice: null, transfer: null };
    expect(decodeRun(encodeRun(combat))).toBeNull();
    const quiz: Run = { ...base, screen: "quiz", quiz: { lessonId: "memory", selected: null, correct: null, boss: false } };
    expect(decodeRun(encodeRun(quiz))).toBeNull();
  });
});
