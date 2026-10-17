import { describe, expect, it } from "vitest";
import { CARD_BY_ID, type Card } from "../src/cards";
import { availableNodes, buy, chooseReward, createRun, enterNode, playCard } from "../src/engine";
import { decodeRun, encodeRun } from "../src/save";
import { readyForCards } from "./fixtures";

const foreign = (uid: string, defId = "compress"): Card => ({ uid, defId, upgraded: true });
function orangeBattle() {
  const base = createRun("engineer", 42);
  return readyForCards(enterNode(base, availableNodes(base)[0].id));
}

describe("专属卡归属在使用和存档恢复时一致", () => {
  it("橙色不能打出蓝色上下文压缩，蓝色可以正常使用，共用牌仍可使用", () => {
    const orange = orangeBattle();
    orange.battle!.hand = [foreign("wrong")];
    expect(playCard(orange, "wrong")).toBe(orange);
    const base = createRun("weaver", 42);
    const blue = readyForCards(enterNode(base, availableNodes(base)[0].id));
    blue.battle!.hand = [foreign("right")];
    expect(playCard(blue, "right").player.energy).toBe(blue.player.energy + 1);
    orange.battle!.hand = [{ uid: "common", defId: "observe", upgraded: false }];
    expect(playCard(orange, "common")).not.toBe(orange);
  });

  it("不能领取或购买旧的跨角色奖励，非法行动不花金币也不改变牌组", () => {
    const run = createRun("engineer", 42);
    run.screen = "reward";
    run.reward = { cards: [foreign("reward")], gold: 25, relic: null };
    expect(chooseReward(run, "reward")).toBe(run);
    const node = availableNodes(createRun("engineer", 42))[0];
    const shopBase = createRun("engineer", 42);
    shopBase.map.find(n => n.id === node.id)!.kind = "shop";
    const shop = enterNode(shopBase, node.id);
    shop.shop!.cards = [{ card: foreign("offer"), price: 20, sold: false }];
    expect(buy(shop, "offer")).toBe(shop);
  });

  it("旧存档所有牌堆及待领取内容修复归属，保留实体、升级和全部其他进度", () => {
    const run = orangeBattle();
    run.deck = [foreign("skill"), foreign("attack", "hybrid"), foreign("power", "retention")];
    run.battle!.hand = [foreign("skill")];
    run.battle!.drawPile = [foreign("attack", "hybrid")];
    run.battle!.discard = [foreign("discard", "memory")];
    run.battle!.exhaust = [foreign("power", "retention")];
    run.reward = { cards: [foreign("pending")], gold: 25, relic: null };
    run.shop = { cards: [{ card: foreign("offer"), price: 65, sold: false }], relic: "heart", relicSold: false, removed: false };
    const fixed = decodeRun(encodeRun(run))!;
    expect(fixed).not.toBeNull();
    const cards = [fixed.deck, fixed.battle!.hand, fixed.battle!.drawPile, fixed.battle!.discard, fixed.battle!.exhaust, fixed.reward!.cards, fixed.shop!.cards.map(o => o.card)];
    for (const pile of cards) for (const card of pile) {
      expect([undefined, "engineer"]).toContain(CARD_BY_ID[card.defId].character);
      expect(card.upgraded).toBe(true);
    }
    expect(fixed.deck.map(c => c.uid)).toEqual(["skill", "attack", "power"]);
    expect(fixed.deck.map(c => c.defId)).toEqual(["observe", "strike", "cache"]);
    expect(fixed.battle!.hand[0]).toEqual(fixed.deck[0]);
    expect(fixed.battle!.drawPile[0]).toEqual(fixed.deck[1]);
    const nonCards = (state: typeof run) => {
      const copy = structuredClone(state);
      copy.deck = [];
      for (const key of ["hand", "drawPile", "discard", "exhaust"] as const) copy.battle![key] = [];
      copy.reward!.cards = [];
      copy.shop!.cards = [];
      return copy;
    };
    expect(nonCards(fixed)).toEqual(nonCards(run));
    expect(decodeRun(encodeRun(fixed))).toEqual(fixed);
  });
});
