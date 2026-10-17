import { describe, expect, it } from "vitest";
import { availableNodes, enterNode, answerQuiz, finishQuiz, type Run } from "../src/engine";
import { decodeRun, encodeRun } from "../src/save";
import { TRIALS, trialQuestion } from "../src/trials";
import { chapterRun } from "./fixtures";

function trial() {
  const run = chapterRun("scholar", 42, 3);
  const node = availableNodes(run)[0];
  node.kind = "quiz";
  node.lessonId = "memory";
  const result = enterNode(run, node.id);
  result.player.hp = 40;
  result.player.potions = ["heal", "energy"];
  return result;
}
describe("入门知识试炼", () => {
  it("三步场景题逐题解释、不能跳题或重复刷奖励，重载保留进度", () => {
    let run = trial();
    expect(run.quiz!.trial).toBeDefined();
    expect(finishQuiz(run)).toBe(run);
    for (let i = 0; i < 3; i++) {
      const q = trialQuestion(run.quiz!);
      expect(q.level).toBe("beginner"); expect(q.intro).toBeTruthy(); expect(q.code).toBe("");
      run = answerQuiz(run, q.correct);
      expect(run.player.gold).toBe(99);
      expect(answerQuiz(run, q.correct)).toBe(run);
      expect(decodeRun(encodeRun(run))).toEqual(run);
      if (i < 2) run = finishQuiz(run);
    }
    expect(run.quiz!.trial!.reward).toMatchObject({ gold: 140, heal: 12 });
    expect(run.quiz!.trial!.reward!.relic).toBeTruthy();
    const claimed = finishQuiz(run);
    expect(claimed.screen).toBe("map");
    expect(claimed.player.gold).toBe(239);
    expect(claimed.player.hp).toBe(52);
    expect(claimed.player.relics).toHaveLength(2);
    expect(finishQuiz(claimed)).toBe(claimed);
  });
  it("两题通过获得金币和药水；不足两题不发通关奖励", () => {
    for (const correctCount of [0, 1, 2]) {
      let run = trial();
      for (let i = 0; i < 3; i++) {
        const q = trialQuestion(run.quiz!);
        run = answerQuiz(run, i < correctCount ? q.correct : (q.correct + 1) % 3);
        if (i < 2) run = finishQuiz(run);
      }
      const result = finishQuiz(run);
      expect(result.player.gold).toBe(correctCount === 2 ? 179 : 99);
      expect(result.player.hp).toBe(correctCount === 2 ? 48 : 40);
      expect(result.player.potions.length - run.player.potions.length).toBe(correctCount === 2 ? 1 : 0);
    }
  });
  it("六十道入门场景题覆盖十章，每章两套试炼并可定位原文", () => {
    expect(TRIALS.flatMap(t => t.questions)).toHaveLength(60);
    expect(new Set(TRIALS.map(t => t.topic))).toEqual(new Set(["beginner"]));
    for (const t of TRIALS) for (const q of t.questions) {
      expect(q.options).toHaveLength(3);
      expect(q.explanation).toBeTruthy();
      expect(q.page + 8).toBeLessThanOrEqual(313);
      expect(q.section).toBeTruthy();
    }
    let run = trial();
    const first = run.quiz!.trial!.id;
    for (let i = 0; i < 3; i++) run = finishQuiz(answerQuiz(run, trialQuestion(run.quiz!).correct));
    const next = availableNodes(run)[0]; next.kind = "quiz"; next.lessonId = "memory";
    run = enterNode(run, next.id);
    expect(run.quiz!.trial!.id).not.toBe(first);
  });
  it("拒绝被篡改的题号、结果、奖励和敌方结算记录", () => {
    const run = trial();
    for (const mutate of [
      (r: Run) => { r.quiz!.trial!.step = 99; },
      (r: Run) => { r.quiz!.trial!.answers = [3]; },
      (r: Run) => { r.quiz!.trial!.reward = { gold: 999999, heal: 9999, relic: "battery", potion: null }; },
      (r: Run) => { r.quiz!.trial!.order = [0,0,1]; },
      (r: Run) => { r.quiz!.trial!.optionOrders = [[0,0,1],[0,1,2],[0,1,2]]; },
    ]) {
      const raw = structuredClone(run); mutate(raw);
      expect(decodeRun(JSON.stringify(raw))).toBeNull();
    }
  });
});
