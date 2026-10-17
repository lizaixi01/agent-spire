import { describe, expect, it } from "vitest";
import { answerQuiz, availableNodes, buy, chooseReward, createRun, enterNode, finishQuiz, type Run } from "../src/engine";
import { trialQuestion, trialReward } from "../src/trials";
import { decodeRun, encodeRun } from "../src/save";

function perfectTrial() {
  const base = createRun("engineer", 42);
  const node = availableNodes(base)[0];
  node.kind = "quiz";
  let run = enterNode(base, node.id);
  run.player.relics = ["anvil", "prism", "battery", "seal", "heart"];
  for (let i = 0; i < 3; i++) {
    run = answerQuiz(run, trialQuestion(run.quiz!).correct);
    if (i < 2) run = finishQuiz(run);
  }
  return run;
}

describe("专属遗物不能跨角色发放", () => {
  it("橙色集齐通用遗物后，完美试炼补金币，不能发蓝色丝线", () => {
    const run = perfectTrial();
    expect(trialReward(run)).toEqual({ gold: 200, heal: 12, relic: null, potion: null });
    const claimed = finishQuiz(run);
    expect(claimed.player.relics).not.toContain("thread");
    expect(claimed.player.relics).not.toContain("lantern");
    expect(claimed.player.gold).toBe(run.player.gold + 200);
  });

  it("旧的记忆丝线待领奖存档可以继续，改为通用池用尽后的金币补偿", () => {
    const run = perfectTrial();
    run.quiz!.trial!.reward = { gold: 140, heal: 12, relic: "thread", potion: null };
    const fixed = decodeRun(encodeRun(run))!;
    expect(fixed).not.toBeNull();
    expect(fixed.quiz!.trial!.reward).toEqual({ gold: 200, heal: 12, relic: null, potion: null });
    expect(fixed.quiz!.trial!.answers).toEqual(run.quiz!.trial!.answers);
    expect(fixed.rng).toBe(run.rng);
    expect(decodeRun(encodeRun(fixed))).toEqual(fixed);
    const claimed = finishQuiz(fixed);
    expect(claimed.player.relics).not.toContain("thread");
    expect(claimed.player.gold).toBe(run.player.gold + 200);
  });

  it("购买和领奖也拒绝错误角色遗物", () => {
    const base = createRun("engineer", 42);
    const node = availableNodes(base)[0]; node.kind = "shop";
    const shop = enterNode(base, node.id);
    shop.player.gold = 999;
    shop.shop!.relic = "thread";
    expect(buy(shop, "relic")).toBe(shop);
    const reward: Run = { ...base, screen: "reward", reward: { cards: [], gold: 25, relic: "thread" } };
    expect(chooseReward(reward, null)).toBe(reward);
    const quiz = perfectTrial();
    quiz.quiz!.trial!.reward = { gold: 140, heal: 12, relic: "thread", potion: null };
    expect(finishQuiz(quiz)).toBe(quiz);
  });

  it("旧存档已持有跨角色遗物时退还六十金币，本角色起始遗物保留", () => {
    const run = createRun("engineer", 42);
    run.player.relics.push("thread");
    const fixed = decodeRun(encodeRun(run))!;
    expect(fixed.player.relics).toEqual(["anvil"]);
    expect(fixed.player.gold).toBe(run.player.gold + 60);
    expect(fixed.player.maxEnergy).toBe(run.player.maxEnergy);
    expect(decodeRun(encodeRun(fixed))).toEqual(fixed);
    const blue = createRun("weaver", 42);
    expect(decodeRun(encodeRun(blue))).toEqual(blue);
    expect(enterNode(run, availableNodes(run)[0].id).battle!.hand).toHaveLength(5);
  });
});
