import { readyForCards } from "./fixtures";
import { describe, expect, it } from "vitest";
import {
  createRun,
  availableNodes,
  enterNode,
  playCard,
  endTurn,
  enemyIntent,
  usePotion,
} from "../src/engine";

function fight(cards = ["strike", "defend", "observe", "react", "defend"]) {
  const run = createRun("scholar", 42);
  run.deck = cards.map((defId, i) => ({
    defId,
    uid: `fixture-${i}`,
    upgraded: false,
  }));
  const started = readyForCards(enterNode(run, availableNodes(run)[0].id));
  // Card arithmetic uses a complete fixed hand; character draw is tested separately.
  started.battle!.hand = structuredClone(run.deck);
  started.battle!.drawPile = [];
  return started;
}

describe("开始一场远征", () => {
  it("从地图开始，携带完整的初始牌组与资源", () => {
    const run = createRun("scholar", 42);
    expect(run.screen).toBe("map");
    expect(run.player.hp).toBe(100);
    expect(run.deck).toHaveLength(10);
    expect(run.player.gold).toBe(99);
    expect(run.act).toBe(1);
  });

  it("同一随机种子产生同一条可重玩的地图", () => {
    expect(createRun("scholar", 42).map).toEqual(createRun("scholar", 42).map);
    expect(createRun("scholar", 42).map).not.toEqual(
      createRun("scholar", 43).map,
    );
  });

  it("只能进入有连线的下一层，不能跳到首领", () => {
    const run = createRun("scholar", 42);
    const boss = run.map.find((n) => n.kind === "boss")!;
    expect(enterNode(run, boss.id)).toEqual(run);
    const next = availableNodes(run)[0];
    const entered = enterNode(run, next.id);
    expect(entered.screen).toBe("combat");
    expect(entered.visited).toContain(next.id);
    expect(run.visited).toEqual([]);
  });
});

describe("卡牌与战斗回合", () => {
  it("绿色战斗开始时抽五张牌，敌人公开下回合意图", () => {
    const base = createRun("scholar", 42);
    const run = enterNode(base, availableNodes(base)[0].id);
    expect(run.battle?.hand).toHaveLength(5);
    expect(run.player.energy).toBe(2);
    expect(enemyIntent(run.battle!.enemies[0], 1).value).toBeGreaterThan(0);
  });

  it("攻击消耗能量，伤害先抵扣敌人格挡，使用过的牌进入弃牌堆", () => {
    const run = fight();
    const battle = run.battle!;
    battle.enemies[0].block = 2;
    const before = battle.enemies[0].hp;
    const card = battle.hand.find((c) => c.defId === "strike")!;
    const result = playCard(run, card.uid, battle.enemies[0].id);
    expect(result.player.energy).toBe(1);
    expect(result.battle!.enemies[0].hp).toBe(before - 4);
    expect(result.battle!.discard.map((c) => c.uid)).toContain(card.uid);
    expect(run.battle!.enemies[0].hp).toBe(before);
  });

  it("能量不足、非法目标、已使用的牌均不改变状态", () => {
    const run = fight();
    run.player.energy = 0;
    const card = run.battle!.hand.find((c) => c.defId === "strike")!;
    expect(playCard(run, card.uid, run.battle!.enemies[0].id)).toEqual(run);
    run.player.energy = 3;
    expect(playCard(run, card.uid, "missing")).toEqual(run);
    expect(playCard(run, "missing", run.battle!.enemies[0].id)).toEqual(run);
  });

  it("格挡抵御本回合攻击，下一回合恢复能量并循环抽牌", () => {
    const run = fight();
    run.battle!.enemies[0].damage = 8;
    const card = run.battle!.hand.find((c) => c.defId === "defend")!;
    const defended = playCard(run, card.uid);
    const result = endTurn(defended);
    expect(result.player.hp).toBe(97);
    expect(result.player.block).toBe(0);
    expect(result.player.energy).toBe(2);
    expect(result.battle!.turn).toBe(2);
    expect(result.battle!.hand).toHaveLength(5);
  });

  it("先观测后打出 ReAct 可获得连携伤害", () => {
    let run = fight();
    const before = run.battle!.enemies[0].hp;
    run = playCard(
      run,
      run.battle!.hand.find((c) => c.defId === "observe")!.uid,
    );
    run = playCard(
      run,
      run.battle!.hand.find((c) => c.defId === "react")!.uid,
      run.battle!.enemies[0].id,
    );
    expect(run.battle!.enemies[0].hp).toBe(before - 14);
    expect(run.learned).toContain("react");
  });

  it("消灭所有敌人才能结算，奖励只发一次，战斗后遗物回血", () => {
    const run = fight();
    run.player.relics = ["lantern"];
    run.player.hp = 50;
    run.battle!.enemies[0].hp = 1;
    const won = playCard(
      run,
      run.battle!.hand.find((c) => c.defId === "strike")!.uid,
      run.battle!.enemies[0].id,
    );
    expect(won.screen).toBe("reward");
    expect(won.player.hp).toBe(56);
    expect(won.reward!.cards).toHaveLength(3);
    expect(endTurn(won)).toEqual(won);
  });

  it("生命归零时结束远征，不能继续出牌", () => {
    const run = fight();
    run.player.hp = 1;
    const dead = endTurn(run);
    expect(dead.screen).toBe("defeat");
    expect(dead.player.hp).toBe(0);
    expect(playCard(dead, dead.battle!.hand[0]?.uid ?? "")).toEqual(dead);
  });

  it("药水会消耗，治疗不超过最大生命，不能重复使用同一份药水", () => {
    const run = fight();
    run.player.hp = 95;
    const healed = usePotion(run, 0);
    expect(healed.player.hp).toBe(100);
    expect(healed.player.potions).toEqual(["energy"]);
    expect(usePotion(healed, 8)).toEqual(healed);
  });
});
