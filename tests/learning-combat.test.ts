import { readyForCards } from "./fixtures";
import { describe, expect, it } from "vitest";
import {
  createRun,
  availableNodes,
  enterNode,
  answerLab,
  playCard,
  endTurn,
} from "../src/engine";
import { CASES, caseForBattle, transferFor } from "../src/learning-cases";
import { LESSON_BY_ID } from "../src/content";
import { decodeRun, encodeRun } from "../src/save";
import { synergyFor } from "../src/synergy";
import { CARD_BY_ID, type CharacterId } from "../src/cards";

function fight(character: CharacterId = "scholar") {
  const r = createRun(character, 42);
  return enterNode(r, availableNodes(r)[0].id);
}
describe("在战斗中应用并迁移原书原理", () => {
  it("首战随机使用本章代码案例，两步判断完成后才获得掌握度", () => {
    const r = fight();
    const c = caseForBattle(r);
    expect(LESSON_BY_ID[c.lesson].chapter).toBe(1);
    expect(c.codeLanguage).toBe("python");
    const first = answerLab(r, c.correct);
    expect(first.player.energy).toBe(r.player.energy + 1);
    expect(first.mastery[c.lesson] ?? 0).toBe(0);
    const lesson = transferFor(c);
    const second = answerLab(first, lesson.correct);
    expect(second.mastery[c.lesson]).toBe(1);
    expect(answerLab(second, lesson.correct)).toBe(second);
    expect(decodeRun(encodeRun(second))).toEqual(second);
  });
  it("错误选择保留后果和解释，不能用反复点击刷取奖励", () => {
    const r = fight();
    const c = caseForBattle(r);
    expect(answerLab(r, -1)).toBe(r);
    const wrong = answerLab(r, (c.correct + 1) % 3);
    expect(wrong.player.energy).toBe(r.player.energy);
    expect(wrong.player.weak).toBe(1);
    const end = answerLab(wrong, transferFor(c).correct);
    expect(end.mastery[c.lesson] ?? 0).toBe(0);
    expect(answerLab(end, c.correct)).toBe(end);
    const nextTurn = endTurn(end);
    expect(answerLab(nextTurn, c.correct)).toBe(nextTurn);
  });
  it("案例有证据、行动后果和教材出处，覆盖原书十章", () => {
    expect(new Set(CASES.map((c) => LESSON_BY_ID[c.lesson].chapter)).size).toBe(
      10,
    );
    for (const c of CASES) {
      expect(c.evidence.length).toBeGreaterThan(10);
      expect(c.options).toHaveLength(3);
      expect(c.consequences).toHaveLength(3);
      expect(c.correct).toBeGreaterThanOrEqual(0);
      expect(c.correct).toBeLessThan(3);
      expect(LESSON_BY_ID[c.lesson].page).toBeGreaterThan(0);
    }
  });
});
describe("连携与战斗压力", () => {
  it("架构约束接工具行动提供额外格挡，检索接行动提供有据伤害", () => {
    for (const [setup, attack, kind, amount] of [
      ["harness", "strike", "block", 4],
      ["hybrid", "strike", "damage", 3],
    ] as const) {
      let r = readyForCards(fight(CARD_BY_ID[setup].character));
      r.battle!.hand = [setup, attack].map((defId, i) => ({
        uid: String(i),
        defId,
        upgraded: false,
      }));
      const target = r.battle!.enemies[0].id;
      r = playCard(r, "0", target);
      expect(synergyFor(r, r.battle!.hand[0])[kind]).toBe(amount);
      const after = playCard(r, "1", target);
      if (kind === "block") expect(after.player.block - r.player.block).toBe(4);
      else
        expect(r.battle!.enemies[0].hp - after.battle!.enemies[0].hp).toBe(9);
      expect(
        synergyFor(endTurn(after), {
          uid: "x",
          defId: "strike",
          upgraded: false,
        }).label,
      ).toBe("");
    }
  });
  it("普通敌人能承受基础牌爆发，蓄势敌人的拖延代价公开且实际生效", () => {
    const r = readyForCards(fight());
    expect(r.battle!.enemies[0].hp).toBeGreaterThanOrEqual(40);
    r.battle!.enemies[0].trait = "rage";
    const next = endTurn(r);
    expect(next.battle!.enemies[0].damage).toBe(
      r.battle!.enemies[0].damage + 1,
    );
  });
});
