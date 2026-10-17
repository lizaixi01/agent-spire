import { describe, expect, it } from "vitest";
import { availableNodes, enterNode, playCard, endTurn, takeBossBait, resolveEvent } from "../src/engine";
import { chapterRun, readyForCards } from "./fixtures";
import { encodeRun, decodeRun } from "../src/save";

describe("首领状态和事件准备的存档边界", () => {
  it("十章机制在出牌、敌方行动与重读后保持完全一致", () => {
    for (let chapter = 1; chapter <= 10; chapter++) {
      const start = chapterRun("scholar", 15, chapter), node = availableNodes(start)[0];
      node.kind = "boss";
      let run = readyForCards(enterNode(start, node.id));
      run.battle!.hand = [{ uid: "s", defId: "defend", upgraded: false }];
      run = playCard(run, "s");
      if (chapter === 8) run = takeBossBait(run);
      const restored = decodeRun(encodeRun(run));
      expect(restored).toEqual(run);
      expect(endTurn(restored!)).toEqual(endTurn(run));
    }
  });
  it("旧存档的既有首领不在战斗中途换规则，下场遭遇才应用新机制", () => {
    const start = chapterRun("scholar", 15), node = availableNodes(start)[0]; node.kind = "boss";
    const legacy = enterNode(start, node.id);
    delete legacy.battle!.enemies[0].boss;
    legacy.battle!.enemies[0].trait = "rage";
    const loaded = decodeRun(encodeRun(legacy));
    expect(loaded?.battle!.enemies[0].boss).toBeUndefined();
    expect(loaded?.battle!.enemies[0].trait).toBe("rage");
  });
  it("拒绝跨章机制、未知卡牌记忆、越界进度与伪造保护状态", () => {
    const start = chapterRun("scholar", 15, 7), node = availableNodes(start)[0]; node.kind = "boss";
    const run = enterNode(start, node.id);
    for (const boss of [
      { kind: "feedback", ready: true },
      { kind: "evaluation", streak: 3, attacked: false, defended: false },
      { kind: "evaluation", streak: 1, attacked: "yes", defended: false },
    ]) {
      const bad = structuredClone(run); Object.assign(bad.battle!.enemies[0], { boss });
      expect(decodeRun(encodeRun(bad))).toBeNull();
    }
    const memoryStart = chapterRun("scholar", 15, 3), memoryNode = availableNodes(memoryStart)[0]; memoryNode.kind = "boss";
    const memory = enterNode(memoryStart, memoryNode.id);
    Object.assign(memory.battle!.enemies[0], { boss: { kind: "retrieval", known: ["constructor"], recalled: false } });
    expect(decodeRun(encodeRun(memory))).toBeNull();
    for (const patch of [{ ward: 3 }, { review: "paid" }]) {
      const bad = structuredClone(run); Object.assign(bad.battle!, patch);
      expect(decodeRun(encodeRun(bad))).toBeNull();
    }
    expect(decodeRun(JSON.stringify({ ...run, preparation: { ward: "yes" } }))).toBeNull();
  });
  it("事件保护可跨房间保存，进入一场战斗消耗准备，抵消攻击后不能恢复额度", () => {
    const start = chapterRun("scholar", 15, 6), node = availableNodes(start)[0]; node.kind = "event";
    const prepared = resolveEvent(enterNode(start, node.id), "risk");
    const saved = decodeRun(encodeRun(prepared))!;
    const fight = readyForCards(enterNode(saved, availableNodes(saved)[0].id));
    fight.battle!.enemies[0].pattern = ["attack"];
    fight.player.block = 0;
    const next = endTurn(fight);
    expect(next.player.hp).toBe(fight.player.hp);
    expect(next.battle!.ward).toBe(false);
    expect(endTurn(decodeRun(encodeRun(next))!).player.hp).toBeLessThan(next.player.hp);
  });
});
