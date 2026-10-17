import { describe, expect, it } from "vitest";
import { createRun, enterNode, availableNodes, answerQuiz, finishQuiz } from "../src/engine";
import { LESSON_BY_ID } from "../src/content";
import { caseForBattle } from "../src/learning-cases";
import { trialQuestion, TRIALS } from "../src/trials";
import { decodeRun, encodeRun } from "../src/save";
import { chapterRun } from "./fixtures";

describe("随机且对应当前章节的学习内容", () => {
  it("十幕地图逐章推进，所有战斗案例与节点教材章节相同", () => {
    const chapters = new Set<number>();
    for (let seed = 1; seed <= 3; seed++) {
      for (let chapter = 1; chapter <= 10; chapter++) {
      const r = chapterRun("scholar", seed, chapter);
      // Derive later acts through public boss/quiz completion flow in expedition tests.
      for (const node of r.map) {
        expect(LESSON_BY_ID[node.lessonId].chapter).toBe(chapter);
        const setup = structuredClone(r); setup.position = null; setup.visited = [];
        setup.map = [ { ...node, row: 0, kind: "combat", next: [] } ];
        const combat = enterNode(setup, node.id);
        chapters.add(LESSON_BY_ID[node.lessonId].chapter);
        expect(LESSON_BY_ID[caseForBattle(combat).lesson].chapter).toBe(LESSON_BY_ID[node.lessonId].chapter);
      }
    }
    }
    expect(chapters.size).toBe(10);
  });
  it("各章都有试炼；不同种子首战案例、题目和选项变化，同种子能恢复复现", () => {
    expect(new Set(TRIALS.flatMap(t => t.questions.map(q => q.chapter))).size).toBe(10);
    const cases = new Set<string>(), variants = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const r = createRun("scholar", seed);
      cases.add(caseForBattle(enterNode(r, availableNodes(r)[0].id)).id);
      const n = availableNodes(r)[0]; n.kind = "quiz";
      const quiz = enterNode(r,n.id);
      const q = trialQuestion(quiz.quiz!);
      expect(q.chapter).toBe(LESSON_BY_ID[n.lessonId].chapter);
      variants.add(q.question + q.options.join("|"));
      expect(enterNode(r,n.id)).toEqual(quiz);
      expect(trialQuestion(decodeRun(encodeRun(quiz))!.quiz!)).toEqual(q);
      const next = finishQuiz(answerQuiz(quiz,q.correct));
      expect(trialQuestion(next.quiz!).question).not.toBe(q.question);
    }
    expect(cases.size).toBeGreaterThan(1);
    expect(variants.size).toBeGreaterThan(5);
  });
});
