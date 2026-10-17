import { describe, expect, it } from "vitest";
import { availableNodes, createRun, enterNode, playCard, endTurn } from "../src/engine";
import { impactFor } from "../src/impact";
import { readyForCards } from "./fixtures";
import { combatFeedback } from "../src/combat-feedback";

function fight(hp = 40, block = 4) {
  const start = createRun("weaver", 42);
  const run = readyForCards(enterNode(start, availableNodes(start)[0].id));
  run.battle!.hand = [{ uid: "three", defId: "flurry", upgraded: false }];
  Object.assign(run.battle!.enemies[0], { hp, maxHp: 40, block, damage: 9, pattern: ["attack"] });
  return run;
}

describe("命中节奏与结算一致", () => {
  it("连击逐拍落下，破盾发生在第二击，最后一击有更重的停顿", () => {
    const run = fight(), card = run.battle!.hand[0];
    const next = playCard(run, card.uid, run.battle!.enemies[0].id);
    const result = impactFor(run, next, card);
    expect(result.beats.map(b => [b.damage, b.blocked, b.breakGuard])).toEqual([[0, 3, false], [2, 1, true], [3, 0, false]]);
    expect(result.beats[0].at).toBeGreaterThanOrEqual(100);
    expect(result.beats[1].at - result.beats[0].at).toBeGreaterThanOrEqual(90);
    expect(result.beats[1].cue).toBe("break");
    expect(result.beats[2].hold).toBeGreaterThan(result.beats[0].hold);
  });
  it("终结停留覆盖最后命中和胜利展示，无效操作不产生时间线", () => {
    const run = fight(4, 0), card = run.battle!.hand[0];
    const result = impactFor(run, playCard(run, card.uid, run.battle!.enemies[0].id), card);
    expect(result.beats).toHaveLength(2);
    expect(result.beats[1].finisher).toBe(true);
    expect(result.settleMs).toBeGreaterThanOrEqual(result.beats[1].at + 600);
    expect(impactFor(run, run, card).beats).toEqual([]);
    expect(impactFor(run, run, card).settleMs).toBe(0);
  });
  it("整套连击都被挡住时不播放末段重伤音，护盾耗尽与实际掉血分别判断", () => {
    const run = fight(40, 20), card = run.battle!.hand[0];
    const result = impactFor(run, playCard(run, card.uid, run.battle!.enemies[0].id), card);
    expect(result.beats.map(b => b.cue)).toEqual(["guard", "guard", "guard"]);
    expect(result.beats.every(b => b.shake <= 12)).toBe(true);
  });
  it("敌人依次出手，分别显示实际格挡与掉血，全挡不会播放受伤音", () => {
    const run = fight(); run.player.block = 12;
    run.battle!.enemies.push({ ...run.battle!.enemies[0], id: "second", damage: 8 });
    const result = impactFor(run, endTurn(run));
    expect(result.beats.map(b => [b.target, b.damage, b.blocked, b.cue])).toEqual([
      ["player", 0, 9, "guard"], ["player", 5, 3, "hurt"],
    ]);
    expect(result.beats[1].at - result.beats[0].at).toBeGreaterThanOrEqual(200);
  });
  it("治疗牌触发反击时，治疗量与受伤量分别显示，不能拿净回血代替治疗", () => {
    const start = createRun("scholar", 42);
    const run = readyForCards(enterNode(start, availableNodes(start)[0].id));
    run.player.hp = 50; run.battle!.enemies[0].boss = { kind: "recovery", lastCard: "banked-reset" };
    run.battle!.hand = [{ uid: "heal", defId: "banked-reset", upgraded: false }];
    const card = run.battle!.hand[0], next = playCard(run, card.uid, run.battle!.enemies[0].id);
    expect(next.player.hp).toBe(196);
    expect(combatFeedback(run, next, card)).toContainEqual({ target: "player", kind: "heal", text: "+150 生命" });
    expect(impactFor(run, next, card).beats[0].damage).toBe(4);
  });
});
