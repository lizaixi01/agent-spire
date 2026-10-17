import { describe, expect, it } from "vitest";
import { availableNodes, enterNode } from "../src/engine";
import { caseForBattle, CASE_BY_ID, transferFor } from "../src/learning-cases";
import { BEGINNER_QUESTIONS } from "../src/beginner-content";
import { ENGINEERING_TRIALS } from "../src/trial-bank";
import { LESSONS } from "../src/content";
import { trialQuestionAt } from "../src/trials";
import { decodeRun, encodeRun } from "../src/save";
import { chapterRun } from "./fixtures";

describe("统一发布时的新题与历史进度兼容", () => {
  it("十章新战斗使用先讲知识的情境题，31 个知识点均有可用练习", () => {
    for (let chapter = 1; chapter <= 10; chapter++) {
      const start = chapterRun("scholar", 12, chapter);
      const fight = enterNode(start, availableNodes(start)[0].id);
      const question = caseForBattle(fight);
      expect(question.level).toBe("beginner");
      expect(question.intro).toBeTruthy();
      expect(question.codeLanguage).toBeUndefined();
      expect(decodeRun(encodeRun(fight))).toEqual(fight);
    }
    for (const lesson of LESSONS) {
      expect(BEGINNER_QUESTIONS.some(q => q.lessonId === lesson.id && q.intro && q.scene)).toBe(true);
    }
  });

  it("旧战斗只替换尚未作答的部分，已选答案及资源和随机状态保留", () => {
    const start = chapterRun("scholar", 12);
    const fight = enterNode(start, availableNodes(start)[0].id);
    const old = CASE_BY_ID["code-v2-agent-observation"];
    fight.battle!.lab = { caseId: old.id, choice: null, transfer: null };
    const pending = decodeRun(encodeRun(fight))!;
    expect(pending).not.toBeNull();
    expect(caseForBattle(pending).level).toBe("beginner");
    expect(pending.player).toEqual(fight.player);
    expect(pending.rng).toBe(fight.rng);

    fight.battle!.lab.choice = old.correct;
    const partial = decodeRun(encodeRun(fight))!;
    expect(partial.battle!.lab).toMatchObject({ caseId: old.id, choice: old.correct, transfer: null });
    expect(caseForBattle(partial).situation).toBe(old.situation);
    expect(transferFor(caseForBattle(partial)).level).toBe("beginner");
    expect(decodeRun(encodeRun(partial))).toEqual(partial);

    fight.battle!.lab.transfer = transferFor(old).correct;
    expect(decodeRun(encodeRun(fight))).toEqual(fight);
  });

  it("旧三步试炼保留已答题面与答案，只转换下一步，重复恢复不再变化", () => {
    const start = chapterRun("scholar", 12);
    const node = availableNodes(start)[0]; node.kind = "quiz";
    const run = enterNode(start, node.id);
    const legacy = ENGINEERING_TRIALS.find(t => t.questions[0].chapter === 1)!;
    const answer = legacy.questions[0].correct;
    run.quiz = { lessonId: legacy.questions[0].lessonId, selected: answer, correct: true, boss: false,
      trial: { id: legacy.id, step: 0, answers: [answer], reward: null, revision: 2,
        order: [0, 1, 2], optionOrders: [[0, 1, 2], [0, 1, 2], [0, 1, 2]] } };
    const restored = decodeRun(encodeRun(run))!;
    expect(restored).not.toBeNull();
    expect(restored.quiz!.trial!.answers).toEqual([answer]);
    expect(trialQuestionAt(restored.quiz!, 0).question).toBe(legacy.questions[0].question);
    expect(trialQuestionAt(restored.quiz!, 1).level).toBe("beginner");
    expect(restored.player).toEqual(run.player);
    expect(restored.rng).toBe(run.rng);
    expect(decodeRun(encodeRun(restored))).toEqual(restored);
  });
});
