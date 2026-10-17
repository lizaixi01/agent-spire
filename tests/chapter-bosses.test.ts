import { describe, expect, it } from "vitest";
import { availableNodes, enterNode, playCard, endTurn, enemyIntent, takeBossBait, usePotion } from "../src/engine";
import { chapterRun, readyForCards } from "./fixtures";

function boss(chapter: number) {
  const run = chapterRun("scholar", 92, chapter);
  const node = availableNodes(run)[0];
  node.kind = "boss";
  const fight = readyForCards(enterNode(run, node.id));
  fight.player.energy = 30;
  fight.player.block = 0;
  fight.battle!.hand = [
    { uid: "a", defId: "strike", upgraded: false },
    { uid: "b", defId: "strike", upgraded: false },
    { uid: "s", defId: "defend", upgraded: false },
    { uid: "o", defId: "observe", upgraded: false },
  ];
  return fight;
}

describe("各章首领的行为与反制", () => {
  it("第一章先观察反馈再行动，会解除本轮的减伤", () => {
    const run = boss(1), id = run.battle!.enemies[0].id;
    const blind = playCard(run, "a", id);
    const prepared = playCard(playCard(run, "s"), "a", id);
    expect(run.battle!.enemies[0].hp - blind.battle!.enemies[0].hp).toBe(3);
    expect(run.battle!.enemies[0].hp - prepared.battle!.enemies[0].hp).toBe(6);
    expect(endTurn(prepared).battle!.enemies[0].boss).toEqual({ kind: "feedback", ready: false });
  });
  it("第二章超出窗口预算会即时改变意图，下一轮重新计数", () => {
    let run = boss(2);
    run.battle!.hand = Array.from({ length: 5 }, (_, i) => ({ uid: `o${i}`, defId: "observe", upgraded: false }));
    const before = enemyIntent(run.battle!.enemies[0], 1).value;
    for (let i = 0; i < 5; i++) run = playCard(run, `o${i}`);
    expect(enemyIntent(run.battle!.enemies[0], 1).value).toBe(before + 2);
    expect(run.battle!.enemies[0].block).toBe(5);
    expect(endTurn(run).battle!.enemies[0].boss).toEqual({ kind: "window", used: 0 });
  });
  it("第三章记住打过的牌；首次召回会拆除记忆壁垒并抽牌", () => {
    const run = boss(3), id = run.battle!.enemies[0].id;
    const first = playCard(run, "a", id);
    const recalled = playCard(first, "b", id);
    expect(first.battle!.enemies[0].block).toBe(6);
    expect(recalled.battle!.enemies[0].block).toBe(0);
    expect(recalled.battle!.enemies[0].hp).toBe(run.battle!.enemies[0].hp - 9);
    expect(recalled.battle!.hand.length).toBe(first.battle!.hand.length);
  });
  it("第四章按只读再执行的契约出牌，会把重击转成防御", () => {
    const run = boss(4), id = run.battle!.enemies[0].id;
    expect(enemyIntent(run.battle!.enemies[0], 1).kind).toBe("heavy");
    const wrong = playCard(playCard(run, "a", id), "s");
    expect(enemyIntent(wrong.battle!.enemies[0], 1).kind).toBe("heavy");
    const right = playCard(playCard(run, "s"), "a", id);
    expect(enemyIntent(right.battle!.enemies[0], 1)).toEqual({ kind: "defend", value: 6 });
    expect(endTurn(right).player.hp).toBe(run.player.hp);
  });
  it("第五章原样重试会减伤并反击，改变动作后恢复正常", () => {
    const run = boss(5), id = run.battle!.enemies[0].id;
    const first = playCard(run, "a", id);
    const repeat = playCard(first, "b", id);
    const changed = playCard(playCard(first, "o"), "b", id);
    expect(first.battle!.enemies[0].hp - repeat.battle!.enemies[0].hp).toBe(3);
    expect(repeat.player.hp).toBe(first.player.hp - 4);
    expect(first.battle!.enemies[0].hp - changed.battle!.enemies[0].hp).toBe(6);
  });
  it("第六章沙箱阶段保留格挡，次回合才释放重击", () => {
    const run = boss(6);
    run.player.block = 22;
    expect(enemyIntent(run.battle!.enemies[0], 1).kind).toBe("defend");
    const next = endTurn(run);
    expect(next.player.block).toBe(16);
    expect(enemyIntent(next.battle!.enemies[0], 2).kind).toBe("heavy");
    expect(endTurn(next).player.block).toBe(0);
  });
  it("第七章需要连续两轮攻击与防御验收，药水也不能绕过验收", () => {
    let run = boss(7), id = run.battle!.enemies[0].id;
    run.battle!.enemies[0].hp = 1;
    run.player.potions = ["fire"];
    run = usePotion(run, 0, id);
    expect(run.screen).toBe("combat");
    for (let round = 0; round < 2; round++) {
      run.player.energy = 10;
      run.battle!.hand = [{ uid: "a", defId: "strike", upgraded: false }, { uid: "s", defId: "defend", upgraded: false }];
      run = endTurn(playCard(playCard(run, "s"), "a", id));
    }
    run.battle!.hand = [{ uid: "finish", defId: "strike", upgraded: false }];
    expect(playCard(run, "finish", id).screen).toBe("reward");
  });
  it("第八章可主动拿能量诱饵，但首领回血并永久强化，单轮只可一次", () => {
    const run = boss(8);
    run.battle!.enemies[0].hp -= 30;
    const bait = takeBossBait(run);
    expect(bait.player.energy).toBe(run.player.energy + 2);
    expect(bait.battle!.enemies[0].hp).toBe(run.battle!.enemies[0].hp + 20);
    expect(enemyIntent(bait.battle!.enemies[0], 1).value).toBe(enemyIntent(run.battle!.enemies[0], 1).value + 3);
    expect(takeBossBait(bait)).toBe(bait);
  });
  it("第九章只适应上一轮伤害最大的牌；换攻击可以避开抗性", () => {
    let run = boss(9), id = run.battle!.enemies[0].id;
    run = endTurn(playCard(run, "a", id));
    run.player.energy = 10;
    run.battle!.hand = [{ uid: "again", defId: "strike", upgraded: false }, { uid: "fresh", defId: "chapter-9-practice", upgraded: false }];
    const resisted = playCard(run, "again", id), changed = playCard(run, "fresh", id);
    expect(run.battle!.enemies[0].hp - resisted.battle!.enemies[0].hp).toBe(0);
    expect(run.battle!.enemies[0].hp - changed.battle!.enemies[0].hp).toBe(7);
  });
  it("第十章是三实体协作；审核者保护指挥者，优先击破会解除减伤", () => {
    const run = boss(10), main = run.battle!.enemies[0];
    expect(run.battle!.enemies).toHaveLength(3);
    const protectedHit = playCard(run, "a", main.id);
    const exposed = structuredClone(run);
    exposed.battle!.enemies[2].hp = 0;
    expect(main.hp - protectedHit.battle!.enemies[0].hp).toBe(3);
    expect(main.hp - playCard(exposed, "a", main.id).battle!.enemies[0].hp).toBe(6);
    const next = endTurn(run);
    expect(next.battle!.enemies[0].block).toBeGreaterThan(0);
  });
  it("所有首领的意图预览与实际行动使用同一规则（含虚弱）", () => {
    for (let chapter = 1; chapter <= 10; chapter++) {
      const run = boss(chapter);
      run.battle!.enemies.forEach(e => { e.weak = 1; });
      const expected = run.battle!.enemies.map(e => ({ enemyId: e.id, ...enemyIntent(e, 1) }));
      const result = endTurn(run);
      expect(result.battle!.enemyActions?.map(({ enemyId, kind, value }) => ({ enemyId, kind, value }))).toEqual(expected);
    }
  });
  it("连续验收漏一轮就归零，毒伤不能绕过封印，诱饵不能绕过教学门控", () => {
    let run = boss(7), id = run.battle!.enemies[0].id;
    run = endTurn(playCard(playCard(run, "s"), "a", id));
    expect(run.battle!.enemies[0].boss).toMatchObject({ streak: 1 });
    run.battle!.enemies[0].hp = 1;
    run.battle!.enemies[0].poison = 10;
    const missed = endTurn(run);
    expect(missed.screen).toBe("combat");
    expect(missed.battle!.enemies[0].hp).toBe(1);
    expect(missed.battle!.enemies[0].boss).toMatchObject({ streak: 0 });
    const locked = boss(8);
    locked.battle!.lab!.transfer = null;
    expect(takeBossBait(locked)).toBe(locked);
    expect(takeBossBait(run)).toBe(run);
  });
});
