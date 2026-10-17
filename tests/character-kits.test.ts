import { describe, expect, it } from "vitest";
import * as engine from "../src/engine";
import { CARD_BY_ID, CHARACTERS, type CharacterId } from "../src/cards";
import { decodeRun, encodeRun } from "../src/save";
import { readyForCards } from "./fixtures";

function fight(character: CharacterId, ids: string[]) {
  const base = engine.createRun(character, 42);
  const run = readyForCards(engine.enterNode(base, engine.availableNodes(base)[0].id));
  run.deck = ids.map((defId, i) => ({ uid: `kit-${i}`, defId, upgraded: false }));
  run.battle!.hand = structuredClone(run.deck);
  run.battle!.drawPile = [];
  Object.assign(run.battle!.enemies[0], { hp: 1000, maxHp: 1000, damage: 0, pattern: ["attack"] });
  return run;
}
function play(run: engine.Run, index = 0) {
  return engine.playCard(run, run.battle!.hand[index].uid, run.battle!.enemies[0].id);
}

describe("专属牌组与遗物", () => {
  it("三角色从不同的十张起始牌组开始，专属卡不混入其他角色商店与奖励", () => {
    const decks = CHARACTERS.map(hero => engine.createRun(hero.id, 42).deck.map(c => c.defId));
    expect(new Set(decks.map(d => d.join(","))).size).toBe(3);
    for (const hero of CHARACTERS) {
      const start = engine.createRun(hero.id, 42);
      expect(start.deck).toHaveLength(10);
      expect(start.deck.some(c => CARD_BY_ID[c.defId].character === hero.id)).toBe(true);
      expect(start.deck.some(c => CARD_BY_ID[c.defId].character && CARD_BY_ID[c.defId].character !== hero.id)).toBe(false);
      for (let act = 1; act <= 3; act++) {
        const base = engine.createRun(hero.id, 42);
        base.act = act;
        const node = engine.availableNodes(base)[0];
        node.kind = "shop";
        const shop = engine.enterNode(base, node.id).shop!;
        expect(shop.cards).toHaveLength(3);
        for (const { card } of shop.cards) {
          expect([undefined, hero.id]).toContain(CARD_BY_ID[card.defId].character);
          expect(card.defId).not.toBe("banked-reset");
        }
        node.kind = "combat";
        let battle = readyForCards(engine.enterNode(base, node.id));
        battle.battle!.enemies[0].hp = 1;
        battle.battle!.hand = [{ uid: "win", defId: "strike", upgraded: false }];
        battle = play(battle);
        expect(battle.reward!.cards).toHaveLength(3);
        for (const card of battle.reward!.cards) expect([undefined, hero.id]).toContain(CARD_BY_ID[card.defId].character);
      }
    }
  });

  it("蓝色零费攻击消耗，三段连击逐段结算力量和格挡，丝线每三牌抽一张", () => {
    let run = fight("weaver", ["quick-strike", "flurry", "defend"]);
    run.player.strength = 2;
    run.battle!.enemies[0].block = 5;
    run.battle!.drawPile = [{ uid: "drawn", defId: "strike", upgraded: false }];
    const energy = run.player.energy;
    run = play(run);
    expect(run.player.energy).toBe(energy);
    expect(run.battle!.exhaust[0].defId).toBe("quick-strike");
    run = play(run);
    expect(run.battle!.enemies[0].hp).toBe(984);
    // Flurry draws the first card; give the relic another card to draw.
    run.battle!.drawPile.push({ uid: "relic-draw", defId: "defend", upgraded: false });
    run = play(run);
    expect(run.battle!.hand.some(c => c.uid === "relic-draw")).toBe(true);
    expect(run.battle!.cardsPlayed).toBe(3);
    expect(engine.endTurn(run).battle!.cardsPlayed).toBe(0);
  });

  it("橙色砧石仅强化每回合第一张高费攻击，下一回合可再次触发", () => {
    let run = fight("engineer", ["heavy-strike", "heavy-strike"]);
    run.player.energy = 8;
    run = play(run);
    expect(run.battle!.enemies[0].hp).toBe(960);
    run = decodeRun(encodeRun(run))!;
    run = play(run);
    expect(run.battle!.enemies[0].hp).toBe(928);
    run = engine.endTurn(run);
    run.battle!.hand = [{ uid: "again", defId: "heavy-strike", upgraded: false }];
    run = play(run);
    expect(run.battle!.enemies[0].hp).toBe(888);
  });

  it("绿色治疗兼顾格挡，重置必须完成工程决策且每幕只能使用一次", () => {
    let run = fight("scholar", ["mend"]);
    run.player.hp = 50;
    run = play(run);
    expect(run.player.hp).toBe(58);
    expect(run.player.block).toBe(8);
    run.battle!.lab!.transfer = null;
    expect(engine.useReset(run)).toBe(run);
    run = readyForCards(run);
    const healed = engine.useReset(run);
    expect(healed.player.hp).toBe(200);
    expect(healed.player.resetCharges).toBe(0);
    expect(run.player.hp).toBe(58);
    healed.player.hp = 30;
    expect(engine.useReset(healed)).toBe(healed);
    expect(decodeRun(encodeRun(healed))).toEqual(healed);
    healed.screen = "quiz";
    healed.quiz = { lessonId: "react", selected: 0, correct: false, boss: true };
    const nextAct = engine.finishQuiz(healed);
    expect(nextAct.player.resetCharges).toBe(1);
    expect(nextAct.deck.some(c => c.defId === "banked-reset")).toBe(false);
  });

  it("未用的重置在过幕时银行化，保留卡跨回合留手，使用后永久移除且不能重复回血", () => {
    let run = engine.createRun("scholar", 42);
    run.screen = "quiz";
    run.quiz = { lessonId: "react", selected: 0, correct: false, boss: true };
    run = engine.finishQuiz(run);
    expect(run.act).toBe(2);
    expect(run.player.resetCharges).toBe(1);
    const banked = run.deck.find(c => c.defId === "banked-reset")!;
    expect(banked).toBeDefined();
    run = readyForCards(engine.enterNode(run, engine.availableNodes(run)[0].id));
    run.battle!.hand = [banked];
    run.battle!.drawPile = [];
    run.battle!.discard = [];
    run = engine.endTurn(run);
    expect(run.battle!.hand.some(c => c.uid === banked.uid)).toBe(true);
    run.player.hp = 10;
    run = engine.playCard(run, banked.uid);
    expect(run.player.hp).toBe(200);
    expect(run.deck.some(c => c.uid === banked.uid)).toBe(false);
    expect(run.battle!.exhaust.some(c => c.uid === banked.uid)).toBe(true);
    expect(engine.playCard(run, banked.uid)).toBe(run);
    expect(decodeRun(encodeRun(run))).toEqual(run);
  });

  it("未用重置跨幕最多储存一张卡，重复结算不增发", () => {
    let run = engine.createRun("scholar", 42);
    for (let i = 0; i < 2; i++) {
      run.screen = "quiz";
      run.quiz = { lessonId: "react", selected: 0, correct: false, boss: true };
      run = engine.finishQuiz(run);
      expect(run.deck.filter(c => c.defId === "banked-reset")).toHaveLength(1);
      expect(engine.finishQuiz(run)).toBe(run);
    }
  });

  it("满血不能浪费重置，缺失额度的旧存档不会凭空补充，非法新字段被拒绝", () => {
    const run = fight("scholar", ["strike"]);
    expect(engine.useReset(run)).toBe(run);
    run.player.hp = 20;
    delete run.player.resetCharges;
    expect(engine.useReset(run)).toBe(run);
    expect(decodeRun(encodeRun(run))).not.toBeNull();
    run.player.resetCharges = 2;
    expect(decodeRun(encodeRun(run))).toBeNull();
    run.player.resetCharges = 1;
    run.battle!.cardsPlayed = -1;
    expect(decodeRun(encodeRun(run))).toBeNull();
  });
});
