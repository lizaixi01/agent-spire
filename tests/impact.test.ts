import { describe, expect, it } from "vitest";
import { availableNodes, createRun, enterNode, playCard, endTurn } from "../src/engine";
import { impactFor } from "../src/impact";
function attack(observed = false, hp = 40) {
  const r = createRun("scholar", 42);
  const b = enterNode(r, availableNodes(r)[0].id);
  b.battle!.lab!.choice = 0;
  b.battle!.lab!.transfer = 0;
  b.battle!.observed = observed;
  b.battle!.enemies[0].hp = hp;
  b.battle!.hand = [
    { uid: "hit", defId: observed ? "react" : "strike", upgraded: false },
  ];
  return b;
}
describe("按事件强弱分层的打击反馈", () => {
  it("普通命中也有短震屏，连携重击具有明显更强的震幅", () => {
    const normal = attack();
    const c = normal.battle!.hand[0];
    const hit = impactFor(
      normal,
      playCard(normal, c.uid, normal.battle!.enemies[0].id),
      c,
    );
    expect(hit.cue).toBe("impact");
    expect(hit.shake).toBeGreaterThanOrEqual(6);
    const combo = attack(true);
    const card = combo.battle!.hand[0];
    const result = impactFor(
      combo,
      playCard(combo, card.uid, combo.battle!.enemies[0].id),
      card,
    );
    expect(result.cue).toBe("combo");
    expect(result.shake).toBeGreaterThanOrEqual(16);
    expect(result.label).toBe("观察 → 行动");
  });
  it("普通受击也有强提示，并记录每个敌人的真实掉血和格挡数值", () => {
    const r = attack();
    r.player.block = 5;
    r.battle!.enemies[0].damage = 9;
    r.battle!.enemies[0].pattern = ["attack"];
    r.battle!.enemies.push({ ...r.battle!.enemies[0], id: "second", damage: 6 });
    const next = endTurn(r);
    const impact = impactFor(r, next);
    expect(impact.cue).toBe("hurt");
    expect(impact.shake).toBeGreaterThanOrEqual(16);
    expect(impact.playerDamage).toBe(10);
    expect(impact.absorbed).toBe(5);
    expect(impact.incoming.map(e => [e.enemyId, e.damage, e.blocked])).toEqual([[r.battle!.enemies[0].id, 4, 5], ["second", 6, 0]]);
  });
  it("剩余格挡自然清空不算被打掉，完全挡住也有护盾命中提示", () => {
    const r = attack(); r.player.block = 20;
    r.battle!.enemies[0].damage = 9;
    r.battle!.enemies[0].pattern = ["attack"];
    const next = endTurn(r); const impact = impactFor(r, next);
    expect(next.player.block).toBe(0);
    expect(impact.playerDamage).toBe(0);
    expect(impact.absorbed).toBe(9);
    expect(impact.cue).toBe("guard");
  });
  it("击杀与整场胜利独立识别；无效行动不产生音效或震动", () => {
    const before = attack(false, 2);
    const c = before.battle!.hand[0];
    const next = playCard(before, c.uid, before.battle!.enemies[0].id);
    const hit = impactFor(before, next, c);
    expect(hit.cue).toBe("victory");
    expect(hit.kills).toHaveLength(1);
    expect(impactFor(before, before, c).cue).toBeNull();
    expect(impactFor(before, before, c).shake).toBe(0);
  });
});
