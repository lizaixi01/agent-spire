import { describe, expect, it } from "vitest";
import {
  availableNodes,
  createRun,
  enterNode,
  playCard,
  endTurn,
  enemyIntent,
  chooseReward,
  answerQuiz,
  finishQuiz,
  rest,
  buy,
  leaveRoom,
  claimTreasure,
  resolveEvent,
  usePotion,
  answerLab,
  useReset,
  type Run,
} from "../src/engine";
import { statsFor, isCardForCharacter, isRelicForCharacter, type Card, type CharacterId } from "../src/cards";
import { trialQuestion } from "../src/trials";
import { LESSON_BY_ID } from "../src/content";
import { decodeRun, encodeRun } from "../src/save";
import { caseForBattle, transferFor } from "../src/learning-cases";

function score(card: Card, run: Run): number {
  const d = statsFor(card);
  const b = run.battle!;
  const enemy = b.enemies.find((e) => e.hp > 0)!;
  const incoming = b.enemies
    .filter((e) => e.hp > 0)
    .reduce((sum, e) => {
      const intent = enemyIntent(e, b.turn);
      return (
        sum + (["attack", "heavy"].includes(intent.kind) ? intent.value : 0)
      );
    }, 0);
  if (d.cost > run.player.energy) return -1000;
  if (d.special === "reset") return run.player.hp <= run.player.maxHp * 0.4 ? 115 : -1000;
  if (d.energy) return 120;
  if (card.defId === "observe") return 110;
  if (d.damage && d.damage + run.player.strength >= enemy.hp + enemy.block)
    return 105;
  if (d.strength) return 85;
  if (d.special === "cache" || d.special === "retention")
    return b.turn < 5 ? 80 : 15;
  if (d.heal && run.player.maxHp - run.player.hp >= d.heal) return 75;
  if (d.block && run.player.block < incoming)
    return 65 + Math.min(d.block, incoming - run.player.block);
  if (d.weak && incoming > 0 && !enemy.weak) return 65;
  if (d.draw && !d.cost) return 100;
  if (d.damage)
    return (
      30 +
      d.damage +
      (d.special === "react" && b.observed ? 10 : 0) +
      (d.special === "echo" ? 7 : 0)
    );
  if (d.draw) return 25;
  return 0;
}
async function autoRun(
  character: CharacterId,
  seed: number,
  applyKnowledge = true,
): Promise<Run> {
  let run = createRun(character, seed);
  for (let step = 0; step < 2500; step++) {
    // Ten chapters run longer than the former three-act campaign. Let the test
    // worker service progress/timeout messages without weakening any assertions.
    if (step % 100 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    // Every state, including noncombat rooms and rewards, must round-trip through storage.
    expect(
      decodeRun(encodeRun(run)),
      `invalid save: ${run.screen}`,
    ).not.toBeNull();
    expect(run.player.hp).toBeGreaterThanOrEqual(0);
    expect(run.player.gold).toBeGreaterThanOrEqual(0);
    const cards = [...run.deck, ...(run.battle?.hand ?? []), ...(run.reward?.cards ?? []), ...(run.shop?.cards.map(o => o.card) ?? [])];
    expect(cards.every(card => isCardForCharacter(card.defId, character)), "cross-character card").toBe(true);
    expect(run.player.relics.every(relic => isRelicForCharacter(relic, character)), "cross-character relic").toBe(true);
    expect([...(run.reward?.cards ?? []), ...(run.shop?.cards.map(o => o.card) ?? [])].every(card => LESSON_BY_ID[statsFor(card).lesson].chapter === run.act), "cross-chapter new card").toBe(true);
    if (run.screen === "victory" || run.screen === "defeat") return run;
    switch (run.screen) {
      case "map": {
        const priority = {
          treasure: 90,
          quiz: 85,
          event: 80,
          rest: run.player.hp < run.player.maxHp * 0.7 ? 95 : 65,
          shop: 70,
          combat: 50,
          elite: 20,
          boss: 10,
        };
        const next = availableNodes(run).sort(
          (a, b) =>
            priority[b.kind] - priority[a.kind] ||
            Math.abs(a.col - 1) - Math.abs(b.col - 1),
        )[0];
        expect(next).toBeDefined();
        run = enterNode(run, next.id);
        break;
      }
      case "combat": {
        expect(LESSON_BY_ID[caseForBattle(run).lesson].chapter).toBe(LESSON_BY_ID[run.map.find(n => n.id === run.position)!.lessonId].chapter);
        if (run.battle!.lab?.transfer === null) {
          const c = caseForBattle(run);
          const correct = run.battle!.lab?.choice === null ? c.correct : transferFor(c).correct;
          run = answerLab(run, applyKnowledge ? correct : (correct + 1) % 3);
          break;
        }
        const target = run.battle!.enemies.find((e) => e.hp > 0)!;
        if (run.player.resetCharges === 1 && run.player.hp <= run.player.maxHp * 0.25) {
          const reset = useReset(run);
          if (reset !== run) { run = reset; break; }
        }
        const heal = run.player.potions.indexOf("heal");
        if (heal >= 0 && run.player.hp <= run.player.maxHp - 20) {
          run = usePotion(run, heal);
          break;
        }
        const fire = run.player.potions.indexOf("fire");
        if (fire >= 0) {
          run = usePotion(run, fire, target.id);
          break;
        }
        const options = run
          .battle!.hand.map((c) => ({ card: c, score: score(c, run) }))
          .sort((a, b) => b.score - a.score);
        if (options[0]?.score > 0)
          run = playCard(run, options[0].card.uid, target.id);
        else run = endTurn(run);
        break;
      }
      case "reward": {
        const candidates = run.reward!.cards.sort((a, b) => {
          const value = (c: Card) => {
            const d = statsFor(c);
            return (
              (d.damage ?? 0) +
              (d.strength ?? 0) * 4 +
              (d.block ?? 0) * 0.5 +
              (d.draw ?? 0) * 2 +
              (d.energy ?? 0) * 4
            );
          };
          return value(b) - value(a);
        });
        run = chooseReward(run, candidates[0].uid);
        break;
      }
      case "quiz":
        expect(trialQuestion(run.quiz!).chapter).toBe(LESSON_BY_ID[run.map.find(n => n.id === run.position)!.lessonId].chapter);
        run = finishQuiz(
          answerQuiz(run, trialQuestion(run.quiz!).correct),
        );
        break;
      case "rest": {
        const upgrade =
          run.deck.find((c) => !c.upgraded && (statsFor(c).damage ?? 0) > 6) ??
          run.deck.find((c) => !c.upgraded);
        run =
          run.player.hp < run.player.maxHp * 0.7 || !upgrade
            ? rest(run, "heal")
            : rest(run, "upgrade", upgrade.uid);
        break;
      }
      case "treasure":
        run = claimTreasure(run);
        break;
      case "event":
        run = resolveEvent(run, "study");
        break;
      case "shop": {
        if (run.player.gold >= 125 && !run.shop!.relicSold)
          run = buy(run, "relic");
        for (const offer of run.shop!.cards) {
          if (
            !offer.sold &&
            run.player.gold >= offer.price &&
            ((statsFor(offer.card).damage ?? 0) >= 8 ||
              (statsFor(offer.card).strength ?? 0) > 0)
          )
            run = buy(run, offer.card.uid);
        }
        run = leaveRoom(run);
        break;
      }
    }
  }
  throw new Error(
    `Expedition failed to terminate: ${character}/${seed}/${run.screen}`,
  );
}

describe("完整远征回归", () => {
  it("应用案例原理的策略在相同种子上能获得更好的完整远征结果", async () => {
    const wins = [0, 0];
    for (const character of ["scholar", "engineer", "weaver"] as const)
      for (let seed = 1; seed <= 10; seed++)
        for (const policy of [0, 1]) {
          const result = await autoRun(character, seed, policy === 1);
          if (result.screen === "victory") wins[policy]++;
        }
    console.info(
      `固定策略比较（各30局）：错误作答 ${wins[0]} 胜；应用与迁移 ${wins[1]} 胜。`,
    );
    expect(wins[1]).toBeGreaterThan(wins[0]);
    expect(wins[0]).toBeLessThan(30);
  }, 120000);
  it("三种角色、各十个种子都能在有限步骤内结算，且每个中间状态可恢复", async () => {
    const victories: Record<string, number> = {};
    for (const character of ["scholar", "engineer", "weaver"] as const) {
      victories[character] = 0;
      for (let seed = 1; seed <= 10; seed++) {
        const final = await autoRun(character, seed);
        expect(["victory", "defeat"]).toContain(final.screen);
        if (final.screen === "victory") {
          victories[character]++;
          expect(final.act).toBe(10);
          expect(final.floors).toBe(90);
        }
      }
      expect(
        victories[character],
        `${character} should have a viable complete route`,
      ).toBeGreaterThan(0);
    }
  }, 120000);
});
