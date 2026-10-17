import { describe, expect, it } from "vitest";
import { availableNodes, createRun, enterNode, answerLab, playCard, endTurn, usePotion, combatUnlocked } from "../src/engine";
import { caseForBattle, transferFor } from "../src/learning-cases";
import { decodeRun, encodeRun } from "../src/save";

function battle() { const r = createRun("scholar", 42); return enterNode(r, availableNodes(r)[0].id); }
describe("工程决策是每场战斗的必经阶段", () => {
  it("两步作答前，卡牌、结束回合、药水都不能绕过决策", () => {
    const before = battle();
    const uid = before.battle!.hand[0].uid;
    const target = before.battle!.enemies[0].id;
    for (const r of [before, answerLab(before, caseForBattle(before).correct)]) {
      expect(combatUnlocked(r)).toBe(false);
      expect(playCard(r, uid, target)).toBe(r);
      expect(endTurn(r)).toBe(r);
      expect(usePotion(r, 0)).toBe(r);
    }
    const c = caseForBattle(before);
    const ready = answerLab(answerLab(before, c.correct), transferFor(c).correct);
    expect(combatUnlocked(ready)).toBe(true);
    expect(playCard(ready, uid, target)).not.toBe(ready);
    expect(combatUnlocked(decodeRun(encodeRun(ready))!)).toBe(true);
  });
  it("答错后仍可读完解释并解锁战斗，保留惩罚且不伪造掌握度", () => {
    const r = battle(); const c = caseForBattle(r);
    const ready = answerLab(answerLab(r, (c.correct + 1) % 3), (transferFor(c).correct + 1) % 3);
    expect(combatUnlocked(ready)).toBe(true);
    expect(ready.player.weak).toBe(1);
    expect(ready.mastery[c.lesson] ?? 0).toBe(0);
    expect(endTurn(ready)).not.toBe(ready);
  });
  it("没有案例字段的旧战斗也要补答，新战斗重新上锁", () => {
    const r = battle(); delete r.battle!.lab;
    expect(combatUnlocked(r)).toBe(false);
    expect(playCard(r, r.battle!.hand[0].uid, r.battle!.enemies[0].id)).toBe(r);
    expect(combatUnlocked(battle())).toBe(false);
  });
});
