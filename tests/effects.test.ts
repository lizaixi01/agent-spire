import { readyForCards } from "./fixtures";
import { describe, expect, it } from "vitest";
import {
  createRun,
  availableNodes,
  enterNode,
  playCard,
  endTurn,
  usePotion,
} from "../src/engine";
import { CARDS, statsFor, type CharacterId } from "../src/cards";
import { LESSON_BY_ID } from "../src/content";

function fight(ids: string[], character: CharacterId = "engineer") {
  const base = createRun(character, 8);
  base.deck = ids.map((defId, i) => ({
    uid: `test-${i}`,
    defId,
    upgraded: false,
  }));
  return readyForCards(enterNode(base, availableNodes(base)[0].id));
}
describe("状态与卡牌效果", () => {
  it("缓存能力消耗本场卡牌，持续增加后续回合能量", () => {
    let run = fight(["cache", "defend", "defend", "defend", "defend"]);
    run = playCard(run, run.battle!.hand.find((c) => c.defId === "cache")!.uid);
    expect(run.battle!.exhaust.map((c) => c.defId)).toContain("cache");
    run = endTurn(run);
    expect(run.player.energy).toBe(4);
    run = endTurn(run);
    expect(run.player.energy).toBe(4);
    expect(run.battle!.hand.some((c) => c.defId === "cache")).toBe(false);
  });
  it("保留能力最多留下八点格挡，普通格挡随后清空", () => {
    let run = fight(["retention"], "scholar");
    run = playCard(
      run,
      run.battle!.hand.find((c) => c.defId === "retention")!.uid,
    );
    run.player.block = 30;
    run = endTurn(run);
    expect(run.player.block).toBe(8);
  });
  it("多段攻击各自受力量加成，先抵消格挡再扣生命", () => {
    let run = fight(["hybrid"], "weaver");
    run.player.strength = 2;
    run.battle!.enemies[0].block = 3;
    const before = run.battle!.enemies[0].hp;
    run = playCard(run, run.battle!.hand[0].uid, run.battle!.enemies[0].id);
    expect(run.battle!.enemies[0].hp).toBe(before - 11);
  });
  it("虚弱降低攻击伤害，易伤放大伤害，伤害向下取整", () => {
    let run = fight(["strike"]);
    run.player.weak = 1;
    run.battle!.enemies[0].vulnerable = 1;
    const before = run.battle!.enemies[0].hp;
    run = playCard(run, run.battle!.hand[0].uid, run.battle!.enemies[0].id);
    expect(run.battle!.enemies[0].hp).toBe(before - 15);
  });
  it("侵蚀绕过格挡并在敌人行动前结算，侵蚀致死能触发胜利", () => {
    const run = fight(["strike"]);
    run.battle!.enemies[0].hp = 3;
    run.battle!.enemies[0].poison = 4;
    run.battle!.enemies[0].block = 20;
    const next = endTurn(run);
    expect(next.screen).toBe("reward");
    expect(next.player.hp).toBe(72);
  });
  it("多目标战斗中击败一名敌人不会提前获胜，死亡目标不能再被攻击", () => {
    const run = fight(["strike", "strike"]);
    const e = run.battle!.enemies[0];
    e.hp = 1;
    run.battle!.enemies.push({ ...e, id: "second", hp: 25, maxHp: 25 });
    const after = playCard(run, run.battle!.hand[0].uid, e.id);
    expect(after.screen).toBe("combat");
    expect(after.battle!.enemies[1].hp).toBe(25);
    expect(playCard(after, after.battle!.hand[0].uid, e.id)).toEqual(after);
  });
  it("药水也能完成击杀，不能从地图消耗药水", () => {
    const run = fight(["strike"]);
    run.player.potions = ["fire"];
    run.battle!.enemies[0].hp = 10;
    expect(usePotion(run, 0, "missing")).toEqual(run);
    expect(usePotion(run, 0, run.battle!.enemies[0].id).screen).toBe("reward");
    const map = createRun();
    expect(usePotion(map, 0)).toEqual(map);
  });
  it("洗牌与抽牌不会复制或丢失卡牌", () => {
    let run = fight([
      "strike",
      "defend",
      "defend",
      "observe",
      "react",
      "defend",
    ]);
    for (let i = 0; i < 6; i++) {
      const b = run.battle!;
      const all = [...b.hand, ...b.drawPile, ...b.discard, ...b.exhaust];
      expect(all).toHaveLength(6);
      expect(new Set(all.map((c) => c.uid)).size).toBe(6);
      run.player.hp = 72;
      run = endTurn(run);
    }
  });
  it("每张卡的教材引用存在，升级描述与实际效果一致", () => {
    for (const def of CARDS) {
      expect(LESSON_BY_ID[def.lesson]).toBeDefined();
      const upgraded = statsFor({ uid: def.id, defId: def.id, upgraded: true });
      expect(upgraded.cost).toBeGreaterThanOrEqual(0);
      if (def.damage) expect(upgraded.damage).toBe(def.damage + 3);
    }
  });
});
