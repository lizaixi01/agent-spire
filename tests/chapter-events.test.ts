import { describe, expect, it } from "vitest";
import { availableNodes, enterNode, resolveEvent, answerLab } from "../src/engine";
import { chapterRun } from "./fixtures";
import { caseForBattle, transferFor } from "../src/learning-cases";
import { eventView } from "../src/chapter-events";
import { canAcquireCard, isCardForCharacter, isRelicForCharacter, type CharacterId } from "../src/cards";
import { encodeRun, decodeRun } from "../src/save";

function event(chapter: number, character: CharacterId = "scholar") {
  const run = chapterRun(character, 9, chapter), node = availableNodes(run)[0];
  node.kind = "event";
  return enterNode(run, node.id);
}
describe("章节事件的实际取舍", () => {
  it("每章都有可达事件，题目与事件知识来源始终属于本章", () => {
    for (let chapter = 1; chapter <= 10; chapter++) {
      const run = chapterRun("scholar", 9, chapter);
      expect(run.map.filter(n => n.row === 4 && n.kind === "event")).toHaveLength(2);
      const trial = resolveEvent(event(chapter), "study");
      expect(trial.screen).toBe("quiz");
      expect(eventView(event(chapter)).chapter).toBe(chapter);
    }
  });
  it("上下文压缩选择移除指定旧牌，并保留其他实体", () => {
    const run = event(2), uid = run.deck[0].uid;
    const next = resolveEvent(run, "risk", uid);
    expect(next.deck).toEqual(run.deck.slice(1));
    expect(next.player.gold).toBe(run.player.gold - 30);
    expect(resolveEvent(next, "risk", uid)).toBe(next);
    expect(resolveEvent(run, "risk", "missing")).toBe(run);
    run.player.gold = 29;
    expect(resolveEvent(run, "risk", uid)).toBe(run);
  });
  it("检索只加入本章、本角色合法卡，不能用参数塞进别人的卡或旧章奖励", () => {
    for (const character of ["scholar", "engineer", "weaver"] as const) {
      const run = event(3, character);
      const view = eventView(run);
      for (const card of view.targets) expect(canAcquireCard(card.defId, character, 3)).toBe(true);
      const next = resolveEvent(run, "risk", view.targets[0].uid);
      expect(next.deck).toHaveLength(run.deck.length + 1);
      expect(next.player.gold).toBe(run.player.gold - 35);
      for (const id of ["compress", "thread", "chapter-2-practice"]) expect(resolveEvent(run, "risk", id)).toBe(run);
    }
  });
  it("第四章升级契约；第五章可以回滚已升级牌来换取恢复预算", () => {
    const run = event(4), uid = run.deck[0].uid;
    expect(resolveEvent(run, "risk", uid).deck[0]).toEqual({ ...run.deck[0], upgraded: true });
    const rollback = event(5);
    rollback.deck[0].upgraded = true;
    const next = resolveEvent(rollback, "risk", rollback.deck[0].uid);
    expect(next.deck[0].upgraded).toBe(false);
    expect(next.player.gold).toBe(rollback.player.gold + 65);
  });
  it("隔离保护只带入下一场战斗，复测押注只在两步均正确后支付一次", () => {
    const ward = resolveEvent(event(6), "risk");
    expect(ward.preparation?.ward).toBe(true);
    const fight = enterNode(ward, availableNodes(ward)[0].id);
    expect(fight.battle!.ward).toBe(true);
    expect(fight.preparation).toBeUndefined();
    const wager = resolveEvent(event(7), "risk");
    const tested = enterNode(wager, availableNodes(wager)[0].id), c = caseForBattle(tested);
    const correct = answerLab(answerLab(tested, c.correct), transferFor(c).correct);
    expect(correct.player.gold).toBe(tested.player.gold + 70);
    expect(correct.battle!.review).toBe("passed");
    expect(answerLab(correct, 0)).toBe(correct);
    const wrong = answerLab(answerLab(tested, (c.correct + 1) % 3), transferFor(c).correct);
    expect(wrong.player.gold).toBe(tested.player.gold);
    expect(wrong.battle!.review).toBe("failed");
  });
  it("奖励事件牺牲生命上限；经验整合合并同名副本；分工交换不同药水", () => {
    const loss = event(8), cap = loss.player.maxHp;
    const gold = resolveEvent(loss, "risk");
    expect(gold.player.maxHp).toBe(cap - 12);
    expect(gold.player.hp).toBe(cap - 12);
    const merge = event(9), selected = merge.deck[0];
    const next = resolveEvent(merge, "risk", selected.uid);
    expect(next.deck.find(c => c.uid === selected.uid)?.upgraded).toBe(true);
    expect(next.deck.length).toBe(merge.deck.length - 1);
    const exchange = event(10);
    exchange.player.potions = ["heal", "heal"];
    expect(resolveEvent(exchange, "risk")).toBe(exchange);
    exchange.player.potions = ["heal", "energy", "fire"];
    const shared = resolveEvent(exchange, "risk");
    expect(shared.player.potions).toEqual(["fire"]);
    expect(shared.player.relics.length).toBe(exchange.player.relics.length + 1);
    expect(decodeRun(encodeRun(shared))).not.toBeNull();
  });
  it("三角色遍历十章事件的真实奖励，存档恢复后仍无跨角色物品", () => {
    for (const character of ["scholar", "engineer", "weaver"] as const) for (let chapter = 1; chapter <= 10; chapter++) {
      const run = event(chapter, character);
      if (chapter === 5) run.deck[0].upgraded = true;
      run.player.potions = ["heal", "energy"];
      const next = resolveEvent(run, "risk", eventView(run).targets[0]?.uid);
      expect(next).not.toBe(run);
      expect(next.deck.every(c => isCardForCharacter(c.defId, character))).toBe(true);
      expect(next.player.relics.every(id => isRelicForCharacter(id, character))).toBe(true);
      expect(decodeRun(encodeRun(next))).toEqual(next);
    }
  });
});
