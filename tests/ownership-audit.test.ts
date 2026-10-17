import { describe, expect, it } from "vitest";
import { CARDS, CHARACTERS, RELICS, isCardForCharacter, isRelicForCharacter, statsFor, type CharacterId, type Card, type RelicId } from "../src/cards";
import { availableNodes, buy, chooseReward, claimTreasure, createRun, enterNode, finishQuiz, playCard, resolveEvent, rest, type Run } from "../src/engine";
import { decodeRun, encodeRun } from "../src/save";
import { readyForCards } from "./fixtures";

const heroes: CharacterId[] = ["scholar", "engineer", "weaver"];
const commonRelics: RelicId[] = ["prism", "battery", "seal", "heart"];
const card = (defId: string, uid = defId): Card => ({ uid, defId, upgraded: true });
function assertOwned(run: Run) {
  const piles = [run.deck, run.reward?.cards ?? [], run.shop?.cards.map(o => o.card) ?? []];
  if (run.battle) piles.push(run.battle.hand, run.battle.drawPile, run.battle.discard, run.battle.exhaust);
  for (const pile of piles) for (const c of pile) expect(isCardForCharacter(c.defId, run.character), `${run.character}/${c.defId}`).toBe(true);
  for (const id of run.player.relics) expect(isRelicForCharacter(id, run.character), `${run.character}/${id}`).toBe(true);
  for (const id of [run.reward?.relic, run.shop?.relic, run.quiz?.trial?.reward?.relic]) if (id) expect(isRelicForCharacter(id, run.character)).toBe(true);
}

describe("全角色、全获取入口与旧存档归属审计", () => {
  it("全部归属元数据与专属起始牌组一致，升级不改变归属", () => {
    const expected: Record<CharacterId, string[]> = {
      weaver: ["hybrid", "mcp", "skill", "discovery", "rag", "event", "handoff", "compress", "quick-strike", "quick-step", "flurry", "flow"],
      engineer: ["pass", "aci", "evaluate", "sft", "evolve", "collab", "review", "heavy-strike", "overdrive", "meteor"],
      scholar: ["harness", "firewall", "memory", "fidelity", "constraint", "recover", "sandbox", "ablate", "retention", "sleep", "mend", "bulwark", "guard-strike", "banked-reset"],
    };
    for (const hero of CHARACTERS) {
      expect(CARDS.filter(c => c.character === hero.id).map(c => c.id).sort()).toEqual(expected[hero.id].sort());
      expect(isRelicForCharacter(hero.relic as RelicId, hero.id)).toBe(true);
      expect(hero.starterDeck).toContain(hero.signature);
      assertOwned(createRun(hero.id, 42));
    }
    for (const def of CARDS) expect(statsFor(card(def.id)).character).toBe(def.character);
    const shared = new Set(["strike", "defend", "observe", "react", "cache", "support", "reward",
      ...Array.from({ length: 10 }, (_, i) => ["practice", "guard", "insight"].map(kind => `chapter-${i + 1}-${kind}`)).flat()]);
    for (const def of CARDS.filter(c => !c.character)) expect(shared.has(def.id), `unclassified card: ${def.id}`).toBe(true);
    const relicOwners: Partial<Record<RelicId, CharacterId>> = { lantern: "scholar", reset: "scholar", anvil: "engineer", thread: "weaver" };
    for (const id of Object.keys(RELICS) as RelicId[]) for (const hero of heroes)
      expect(isRelicForCharacter(id, hero)).toBe(commonRelics.includes(id) || relicOwners[id] === hero);
  });

  it("每张其他角色专属卡均不能打出、购买或领取，也不花费资源", () => {
    for (const hero of heroes) for (const def of CARDS.filter(c => c.character && c.character !== hero)) {
      const base = createRun(hero, 42);
      const battle = readyForCards(enterNode(base, availableNodes(base)[0].id));
      battle.battle!.hand = [card(def.id)];
      expect(playCard(battle, def.id, battle.battle!.enemies[0].id)).toBe(battle);
      const reward: Run = { ...base, screen: "reward", reward: { cards: [card(def.id)], gold: 25, relic: null } };
      expect(chooseReward(reward, def.id)).toBe(reward);
      const shop: Run = { ...base, screen: "shop", shop: { cards: [{ card: card(def.id), price: 1, sold: false }], relic: "heart", relicSold: false, removed: false } };
      expect(buy(shop, def.id)).toBe(shop);
    }
  });

  it("各角色起始遗物都不能从其他角色购买或领奖入口取得", () => {
    for (const hero of heroes) for (const id of Object.keys(RELICS) as RelicId[]) {
      if (isRelicForCharacter(id, hero)) continue;
      const base = createRun(hero, 42);
      const reward: Run = { ...base, screen: "reward", reward: { cards: [], gold: 25, relic: id } };
      expect(chooseReward(reward, null)).toBe(reward);
      const shop: Run = { ...base, screen: "shop", shop: { cards: [], relic: id, relicSold: false, removed: false } };
      shop.player.gold = 999;
      expect(buy(shop, "relic")).toBe(shop);
    }
  });

  it("商店、普通/精英/首领奖励、宝箱和事件各入口均保留归属", () => {
    for (const hero of heroes) for (let seed = 1; seed <= 12; seed++) {
      for (const room of ["shop", "combat", "elite", "boss", "treasure", "event"] as const) {
        const base = createRun(hero, seed);
        const node = availableNodes(base)[0]; node.kind = room;
        let run = enterNode(base, node.id);
        if (room === "shop") {
          assertOwned(run);
          run.player.gold = 9999;
          for (const offer of run.shop!.cards) run = buy(run, offer.card.uid);
          run = buy(run, "relic");
        } else if (room === "treasure") run = claimTreasure(run);
        else if (room === "event") run = resolveEvent(run, "study");
        else {
          run = readyForCards(run);
          run.battle!.enemies.forEach((e, i) => e.hp = i ? 0 : 1);
          run.battle!.hand = [card("strike")];
          run = playCard(run, "strike", run.battle!.enemies[0].id);
          assertOwned(run);
          expect(commonRelics).toContain(run.reward!.relic ?? "heart");
          run = chooseReward(run, run.reward!.cards[0].uid);
        }
        assertOwned(run);
      }
    }
  });

  it("重置卡只允许过幕生成，不能从奖励或商店直接领取", () => {
    for (const hero of heroes) {
      const base = createRun(hero, 42);
      base.screen = "quiz";
      base.quiz = { lessonId: "react", selected: 0, correct: false, boss: true };
      const next = finishQuiz(base);
      expect(next.deck.filter(c => c.defId === "banked-reset")).toHaveLength(hero === "scholar" ? 1 : 0);
      assertOwned(next);
    }
    const base = createRun("scholar", 42);
    const reward: Run = { ...base, screen: "reward", reward: { cards: [card("banked-reset")], gold: 25, relic: null } };
    expect(chooseReward(reward, "banked-reset")).toBe(reward);
    const shop: Run = { ...base, screen: "shop", shop: { cards: [{ card: card("banked-reset"), price: 1, sold: false }], relic: "heart", relicSold: false, removed: false } };
    expect(buy(shop, "banked-reset")).toBe(shop);
    expect(decodeRun(encodeRun(reward))!.reward!.cards[0].defId).not.toBe("banked-reset");
    expect(decodeRun(encodeRun(shop))!.shop!.cards[0].card.defId).not.toBe("banked-reset");
  });

  it("所有角色的所有旧牌堆、旧遗物、旧待领奖和旧商店恢复后均不串角色", () => {
    for (const hero of heroes) {
      const base = createRun(hero, 42);
      const run = readyForCards(enterNode(base, availableNodes(base)[0].id));
      const foreign = CARDS.filter(c => c.character && c.character !== hero).map(c => card(c.id));
      run.deck.push(...foreign);
      for (const [index, key] of (["hand", "drawPile", "discard", "exhaust"] as const).entries()) run.battle![key] = structuredClone(foreign.filter((_, i) => i % 4 === index));
      const foreignRelics = (Object.keys(RELICS) as RelicId[]).filter(id => !isRelicForCharacter(id, hero));
      run.player.relics.push(...foreignRelics);
      run.reward = { cards: structuredClone(foreign), gold: 50, relic: foreignRelics[0] };
      run.shop = { cards: foreign.map(c => ({ card: structuredClone(c), price: 65, sold: false })), relic: foreignRelics[0], relicSold: false, removed: false };
      const fixed = decodeRun(encodeRun(run))!;
      expect(fixed).not.toBeNull();
      assertOwned(fixed);
      expect(fixed.deck.map(c => [c.uid, c.upgraded])).toEqual(run.deck.map(c => [c.uid, c.upgraded]));
      expect(fixed.player.gold).toBe(run.player.gold + foreignRelics.length * 60);
      expect(fixed.rng).toBe(run.rng);
      expect(fixed.visited).toEqual(run.visited);
      expect(decodeRun(encodeRun(fixed))).toEqual(fixed);
    }
  });

  it("旧档跨角色能力与连携不能留下持续增益；不能继续升级非法专属卡", () => {
    const base = createRun("engineer", 42);
    const run = readyForCards(enterNode(base, availableNodes(base)[0].id));
    run.battle!.retention = true;
    run.battle!.sequence = ["hybrid"];
    run.battle!.exhaust.push(card("retention"));
    const fixed = decodeRun(encodeRun(run))!;
    expect(fixed.battle!.retention).toBe(false);
    expect(fixed.battle!.sequence).toEqual([]);
    const blue = createRun("weaver", 42);
    const blueBattle = readyForCards(enterNode(blue, availableNodes(blue)[0].id));
    blueBattle.player.strength = 3;
    blueBattle.battle!.exhaust.push(card("sft"));
    expect(decodeRun(encodeRun(blueBattle))!.player.strength).toBe(0);
    const resting = createRun("engineer", 42);
    resting.screen = "rest";
    resting.deck.push({ uid: "foreign", defId: "hybrid", upgraded: false });
    expect(rest(resting, "upgrade", "foreign")).toBe(resting);
  });
});
