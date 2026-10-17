import { describe, expect, it } from "vitest";
import { availableNodes, createRun, endTurn, enterNode, playCard } from "../src/engine";
import { CARD_BY_ID, cardText, type CharacterId } from "../src/cards";
import { decodeRun, encodeRun } from "../src/save";
import { readyForCards } from "./fixtures";

function battle(character: CharacterId) {
  const run = createRun(character, 42);
  run.deck = Array.from({ length: 15 }, (_, i) => ({ uid: `strike-${i}`, defId: "strike", upgraded: false }));
  const started = readyForCards(enterNode(run, availableNodes(run)[0].id));
  Object.assign(started.battle!.enemies[0], { hp: 1000, maxHp: 1000, damage: 0, pattern: ["attack"] });
  return started;
}

describe("三种角色的战斗流派", () => {
  it("蓝色首回合九张牌，但五点能量要求在一费牌之间取舍，后续抽八张", () => {
    let run = battle("weaver");
    expect(run.battle!.hand).toHaveLength(9);
    for (let i = 0; i < 5; i++) {
      const before = run;
      run = playCard(run, run.battle!.hand[0].uid, run.battle!.enemies[0].id);
      expect(run).not.toBe(before);
    }
    expect(run.player.energy).toBe(0);
    expect(playCard(run, run.battle!.hand[0].uid, run.battle!.enemies[0].id)).toBe(run);
    run = endTurn(run);
    expect(run.player.energy).toBe(5);
    expect(run.battle!.hand).toHaveLength(8);
  });

  it("橙色普通攻击造成十四点伤害，力量跨回合保留且新战斗重新初始化", () => {
    let run = battle("engineer");
    expect(cardText(run.battle!.hand[0], run.player.strength)).toBe("造成 14 点伤害。");
    expect(cardText(run.battle!.hand[0], run.player.strength, 1)).toBe("造成 10 点伤害。");
    run = playCard(run, run.battle!.hand[0].uid, run.battle!.enemies[0].id);
    expect(run.battle!.enemies[0].hp).toBe(986);
    run = endTurn(run);
    expect(run.player.strength).toBe(8);
    run.screen = "map";
    run.player.strength = 99;
    run = enterNode(run, availableNodes(run)[0].id);
    expect(run.player.strength).toBe(8);
  });

  it("绿色拥有一百生命，基础回合只能打两张一费牌并抽五张", () => {
    let run = battle("scholar");
    expect(run.player.hp).toBe(100);
    expect(run.player.maxHp).toBe(100);
    expect(run.battle!.hand).toHaveLength(5);
    for (let i = 0; i < 2; i++) run = playCard(run, run.battle!.hand[0].uid, run.battle!.enemies[0].id);
    expect(playCard(run, run.battle!.hand[0].uid, run.battle!.enemies[0].id)).toBe(run);
    run = endTurn(run);
    expect(run.player.energy).toBe(2);
    expect(run.battle!.hand).toHaveLength(5);
  });

  it("绿色初始牌组的首回合总有可用攻击，不会整手只剩防守", () => {
    for (let seed = 1; seed <= 32; seed++) {
      const base = createRun("scholar", seed);
      for (const node of availableNodes(base)) {
        const run = enterNode(base, node.id);
        expect(run.battle!.hand.some(c => CARD_BY_ID[c.defId].damage && CARD_BY_ID[c.defId].cost <= run.player.energy)).toBe(true);
      }
    }
  });

  it.each(["scholar", "engineer", "weaver"] as const)("%s 的角色资源与战斗存档可完整恢复", character => {
    const run = battle(character);
    const restored = decodeRun(encodeRun(run));
    expect(restored).toEqual(run);
    expect(endTurn(restored!)).toEqual(endTurn(run));
  });
});
