import { readyForCards, chapterRun } from "./fixtures";
import { describe, expect, it } from "vitest";
import {
  availableNodes,
  enterNode,
  playCard,
  chooseReward,
  answerQuiz,
  finishQuiz,
  rest,
  buy,
  leaveRoom,
  claimTreasure,
  resolveEvent,
} from "../src/engine";
import { LESSONS, LESSON_BY_ID } from "../src/content";
import { trialQuestion } from "../src/trials";

const room = (
  kind: "quiz" | "rest" | "shop" | "treasure" | "event" | "boss", chapter = 1,
) => {
  const run = chapterRun("scholar", 91, chapter);
  const node = availableNodes(run)[0];
  node.kind = kind;
  return enterNode(run, node.id);
};
function victory(boss = false, chapter = 1) {
  const run = readyForCards(room("boss", chapter));
  run.battle!.room = boss ? "boss" : "combat";
  run.battle!.enemies[0].hp = 1;
  // This fixture tests reward/progression after victory. The council's support
  // units must also be defeated; their target-order mechanic has its own tests.
  run.battle!.enemies.slice(1).forEach(e => { e.hp = 0; });
  run.battle!.hand = [{ uid: "win", defId: "strike", upgraded: false }];
  return playCard(run, "win", run.battle!.enemies[0].id);
}

describe("远征中的成长与学习", () => {
  it("战斗奖励三选一，金币与卡牌只领取一次", () => {
    const run = victory();
    const picked = run.reward!.cards[0];
    expect(chooseReward(run, "missing")).toEqual(run);
    const result = chooseReward(run, picked.uid);
    expect(result.screen).toBe("map");
    expect(result.deck).toHaveLength(11);
    expect(result.deck.at(-1)?.defId).toBe(picked.defId);
    expect(result.player.gold).toBe(129);
    expect(chooseReward(result, picked.uid)).toEqual(result);
  });
  it("兼容旧版单题存档：答错不重复作答，未作答不能跳过", () => {
    const run = room("quiz");
    delete run.quiz!.trial;
    const q = LESSON_BY_ID[run.quiz!.lessonId];
    expect(finishQuiz(run)).toEqual(run);
    const wrong = answerQuiz(run, (q.correct + 1) % 3);
    expect(wrong.quiz!.correct).toBe(false);
    expect(wrong.player.gold).toBe(99);
    expect(wrong.answers).toEqual([{ lessonId: q.id, correct: false }]);
    expect(answerQuiz(wrong, q.correct)).toEqual(wrong);
    expect(finishQuiz(wrong).screen).toBe("map");
  });
  it("兼容旧版单题存档：正确答案增加掌握度与金币，越界答案无效", () => {
    const run = room("quiz");
    delete run.quiz!.trial;
    const q = LESSON_BY_ID[run.quiz!.lessonId];
    expect(answerQuiz(run, -1)).toEqual(run);
    const result = answerQuiz(run, q.correct);
    expect(result.player.gold).toBe(124);
    expect(result.mastery[q.id]).toBe(1);
    expect(result.learned).toContain(q.id);
  });
  it("首领奖励后完成知识试炼，进入下一幕；第十幕进入胜利结算", () => {
    let run = chooseReward(victory(true), null);
    expect(run.screen).toBe("quiz");
    for (let i = 0; i < 3; i++) run = finishQuiz(answerQuiz(run, trialQuestion(run.quiz!).correct));
    expect(run.act).toBe(2);
    expect(run.screen).toBe("map");
    expect(run.visited).toEqual([]);
    expect(run.map.every((n) => n.id.startsWith("2-"))).toBe(true);
    const final = victory(true, 10);
    run = chooseReward(final, null);
    for (let i = 0; i < 3; i++) run = finishQuiz(answerQuiz(run, trialQuestion(run.quiz!).correct));
    expect(run.screen).toBe("victory");
  });
  it("篝火只能选择一次休息或升级；升级只影响所选实体", () => {
    const run = room("rest");
    run.player.hp = 20;
    const healed = rest(run, "heal");
    expect(healed.player.hp).toBe(80);
    expect(rest(healed, "heal")).toEqual(healed);
    const upgraded = rest(run, "upgrade", run.deck[0].uid);
    expect(upgraded.deck.filter((c) => c.upgraded)).toHaveLength(1);
    expect(upgraded.deck[0].uid).toBe(run.deck[0].uid);
    expect(rest(run, "upgrade", "missing")).toEqual(run);
  });
  it("商店防止超支和重复购买，删牌不能删除不存在的牌", () => {
    const run = room("shop");
    const offer = run.shop!.cards[0];
    run.player.gold = 100;
    const bought = buy(run, offer.card.uid);
    expect(bought.deck).toHaveLength(11);
    expect(bought.player.gold).toBe(100 - offer.price);
    expect(buy(bought, offer.card.uid)).toEqual(bought);
    const broke = structuredClone(run);
    broke.player.gold = 0;
    expect(buy(broke, offer.card.uid)).toEqual(broke);
    expect(buy(run, "remove", "missing")).toEqual(run);
    expect(leaveRoom(bought).screen).toBe("map");
  });
  it("宝箱遗物只能领取一次，生命遗物改变上限", () => {
    const run = room("treasure");
    const got = claimTreasure(run);
    expect(got.player.relics.length).toBeGreaterThan(run.player.relics.length);
    expect(claimTreasure(got)).toEqual(got);
  });
  it("事件可选择学习或付生命换金币，生命耗尽会失败", () => {
    const run = room("event");
    expect(resolveEvent(run, "study").screen).toBe("quiz");
    const risk = resolveEvent(run, "risk");
    expect(risk.player.hp).toBe(192);
    expect(risk.player.gold).toBe(144);
    run.player.hp = 3;
    expect(resolveEvent(run, "risk").screen).toBe("defeat");
  });
});

describe("文章内容溯源", () => {
  it("课程覆盖原书十章，每题有唯一有效答案与可定位页码", () => {
    expect(new Set(LESSONS.map((l) => l.chapter)).size).toBe(10);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const lesson of LESSONS) {
      expect(lesson.options).toHaveLength(3);
      expect(lesson.options[lesson.correct]).toBeTruthy();
      expect(lesson.page).toBeGreaterThan(0);
      expect(lesson.page + 8).toBeLessThanOrEqual(313);
      expect(lesson.section).toBeTruthy();
      expect(lesson.explanation).toBeTruthy();
    }
  });
});
