import { readyForCards } from "./fixtures";
import { describe, expect, it } from "vitest";
import { createRun, enterNode, availableNodes, playCard, answerLab } from "../src/engine";
import { combatFeedback } from "../src/combat-feedback";
import { caseForBattle, transferFor } from "../src/learning-cases";

function fight() {
  const run = createRun("scholar", 42);
  run.deck = ["strike", "defend", "observe", "cache", "memory"].map(
    (defId, i) => ({ uid: `card-${i}`, defId, upgraded: false }),
  );
  const started = readyForCards(enterNode(run, availableNodes(run)[0].id));
  started.battle!.hand = structuredClone(run.deck);
  started.battle!.drawPile = [];
  return started;
}
describe("出牌反馈反映实际结果", () => {
  it("工程决策的额外能量、抽牌、金币与掌握均显示到账，重复点击不重播奖励", () => {
    const map = createRun("weaver", 42), run = enterNode(map, availableNodes(map)[0].id);
    run.battle!.drawPile = [{ uid: "bonus", defId: "defend", upgraded: false }];
    const scenario = caseForBattle(run), first = answerLab(run, scenario.correct);
    expect(combatFeedback(run, first)).toEqual(expect.arrayContaining([
      { target: "player", kind: "energy", text: "能量 +1" },
      { target: "player", kind: "draw", text: "抽牌 +1" },
    ]));
    const second = answerLab(first, transferFor(scenario).correct);
    expect(combatFeedback(first, second)).toEqual(expect.arrayContaining([
      { target: "player", kind: "gold", text: "+10 金币" },
      { target: "player", kind: "mastery", text: "掌握 +1" },
    ]));
    expect(combatFeedback(second, answerLab(second, transferFor(scenario).correct))).toEqual([]);
  });
  it("伤害与吸收分别显示真实数值，不把牌面伤害当作掉血", () => {
    const before = fight();
    const enemy = before.battle!.enemies[0];
    enemy.block = 2;
    const card = before.battle!.hand.find((c) => c.defId === "strike")!;
    const after = playCard(before, card.uid, enemy.id);
    expect(combatFeedback(before, after, card)).toEqual(
      expect.arrayContaining([
        { target: enemy.id, kind: "damage", text: "−4" },
        { target: enemy.id, kind: "absorb", text: "抵挡 2" },
      ]),
    );
  });
  it("能量不足不产生成功出牌反馈；致死攻击只显示实际失去的生命", () => {
    const before = fight();
    const card = before.battle!.hand.find((c) => c.defId === "strike")!;
    const enemy = before.battle!.enemies[0];
    before.player.energy = 0;
    expect(
      combatFeedback(before, playCard(before, card.uid, enemy.id), card),
    ).toEqual([]);
    before.player.energy = 3;
    enemy.hp = 2;
    expect(
      combatFeedback(before, playCard(before, card.uid, enemy.id), card),
    ).toContainEqual({ target: enemy.id, kind: "damage", text: "−2" });
  });
  it("格挡牌显示护盾增量，观测牌显示抽牌，能力牌显示持续效果", () => {
    for (const [id, kind, text] of [
      ["defend", "block", "+5 格挡"],
      ["cache", "power", "缓存 +1"],
    ] as const) {
      const before = fight();
      const card = before.battle!.hand.find((c) => c.defId === id)!;
      expect(
        combatFeedback(
          before,
          playCard(before, card.uid, before.battle!.enemies[0].id),
          card,
        ),
      ).toContainEqual({ target: "player", kind, text });
    }
    const before = fight();
    before.battle!.drawPile.push({
      uid: "new-card",
      defId: "defend",
      upgraded: false,
    });
    const observe = before.battle!.hand.find((c) => c.defId === "observe")!;
    expect(
      combatFeedback(before, playCard(before, observe.uid), observe),
    ).toContainEqual({ target: "player", kind: "draw", text: "抽牌 +1" });
  });
});
