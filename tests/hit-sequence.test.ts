import { describe, expect, it } from "vitest";
import { availableNodes, createRun, enterNode, playCard, endTurn, usePotion } from "../src/engine";
import { readyForCards } from "./fixtures";
import { decodeRun, encodeRun } from "../src/save";

function fight(hp = 20, block = 4) {
  const start = createRun("weaver", 42);
  const run = readyForCards(enterNode(start, availableNodes(start)[0].id));
  run.battle!.hand = [
    { uid: "three", defId: "flurry", upgraded: false },
    { uid: "shield", defId: "defend", upgraded: false },
  ];
  run.player.strength = 0;
  Object.assign(run.battle!.enemies[0], { hp, maxHp: 20, block });
  return run;
}

describe("逐次命中的真实结算", () => {
  it("三连击分别记录挡住3、挡住1掉血2、掉血3，不能把总伤害平均分", () => {
    const run = fight();
    const next = playCard(run, "three", run.battle!.enemies[0].id);
    expect(next.battle!.attackHits?.map(h => [h.damage, h.blocked, h.hpAfter, h.blockAfter])).toEqual([
      [0, 3, 20, 1], [2, 1, 18, 0], [3, 0, 15, 0],
    ]);
    expect(run.battle!.enemies[0].hp).toBe(20);
  });
  it("只剩4生命时第二击终结，不伪造第三击和过量伤害；辅助牌与敌方回合不重播旧攻击", () => {
    const run = fight(4, 0);
    run.battle!.enemies.push({ ...run.battle!.enemies[0], id: "survivor", hp: 20 });
    const next = playCard(run, "three", run.battle!.enemies[0].id);
    expect(next.battle!.attackHits?.map(h => h.damage)).toEqual([3, 1]);
    expect(playCard(next, "missing")).toBe(next);
    expect(playCard(next, "shield").battle!.attackHits).toEqual([]);
    expect(endTurn(next).battle!.attackHits).toEqual([]);
  });
  it("火焰药水同样记录实际伤害与破盾；治疗药水不会重播上次命中", () => {
    const run = fight(8, 5);
    run.player.potions = ["fire", "heal"];
    const next = usePotion(run, 0, run.battle!.enemies[0].id);
    expect(next.battle!.attackHits).toEqual([expect.objectContaining({ damage: 8, blocked: 5, hpAfter: 0, blockAfter: 0 })]);
    const alive = fight();
    alive.player.potions = ["fire", "heal"];
    const hit = usePotion(alive, 0, alive.battle!.enemies[0].id);
    expect(usePotion(hit, 0).battle!.attackHits).toEqual([]);
  });
  it("记录可随存档恢复，拒绝伪造命中数值；首领封印不能显示超额伤害", () => {
    const run = fight();
    const next = playCard(run, "three", run.battle!.enemies[0].id);
    expect(decodeRun(encodeRun(next))).toEqual(next);
    next.battle!.attackHits![0].damage = 99;
    expect(decodeRun(encodeRun(next))).toBeNull();
    const sealed = fight(2, 0);
    sealed.battle!.enemies[0].boss = { kind: "evaluation", streak: 0, attacked: false, defended: false };
    const result = playCard(sealed, "three", sealed.battle!.enemies[0].id);
    expect(result.battle!.attackHits?.map(h => h.damage)).toEqual([1, 0, 0]);
  });
  it("首领反击也有独立受击事件，能区分实际伤害和隔离保护", () => {
    const run = fight();
    run.battle!.hand = [{ uid: "hit", defId: "strike", upgraded: false }];
    run.battle!.enemies[0].boss = { kind: "recovery", lastCard: "strike" };
    run.player.block = 1;
    const next = playCard(run, "hit", run.battle!.enemies[0].id);
    expect(next.battle!.enemyActions).toEqual([expect.objectContaining({ kind: "attack", damage: 3, blocked: 1 })]);
    run.battle!.ward = true;
    const guarded = playCard(run, "hit", run.battle!.enemies[0].id);
    expect(guarded.battle!.enemyActions).toEqual([expect.objectContaining({ damage: 0, blocked: 0 })]);
  });
});
