import { CARD_BY_ID, CHARACTERS, canAcquireCard, isCardForCharacter, isRelicForCharacter, rewardRelics, type Card } from "./cards";
import type { Run } from "./engine";
import { trialReward } from "./trials";
import { LESSON_BY_ID } from "./content";

// Operates only on a newly parsed, structurally validated save, without randomness.
export function restoreCharacterOwnership(run: Run): void {
  const battle = run.battle;
  if (battle) {
    const activeCards = [...battle.hand, ...battle.drawPile, ...battle.discard, ...battle.exhaust];
    const foreignStrength = activeCards.some(c => !isCardForCharacter(c.defId, run.character) && CARD_BY_ID[c.defId].strength) ||
      battle.sequence?.some(id => !isCardForCharacter(id, run.character) && CARD_BY_ID[id].strength);
    // Exact historical contributions cannot be reconstructed after multiple shuffles.
    if (foreignStrength) run.player.strength = CHARACTERS.find(c => c.id === run.character)!.strength;
    if (!isCardForCharacter("retention", run.character)) battle.retention = false;
    if (battle.sequence?.some(id => !isCardForCharacter(id, run.character))) battle.sequence = [];
  }
  const replace = (card: Card) => {
    const def = CARD_BY_ID[card.defId];
    card.defId = def.type === "attack" ? "strike" : def.type === "power" ? "cache" : def.cost === 0 ? "observe" : "defend";
  };
  const ownedPiles = [run.deck];
  if (battle) ownedPiles.push(battle.hand, battle.drawPile, battle.discard, battle.exhaust);
  for (const pile of ownedPiles) for (const card of pile) if (!isCardForCharacter(card.defId, run.character)) replace(card);
  for (const card of [...(run.reward?.cards ?? []), ...(run.shop?.cards.map(o => o.card) ?? [])])
    if (!canAcquireCard(card.defId, run.character)) replace(card);
  for (const card of [...(run.reward?.cards ?? []), ...(run.shop?.cards.map(o => o.card) ?? [])]) {
    const def = CARD_BY_ID[card.defId];
    if (LESSON_BY_ID[def.lesson].chapter !== run.act)
      card.defId = `chapter-${run.act}-${def.type === "attack" ? "practice" : def.type === "power" ? "insight" : "guard"}`;
  }

  const legalRelics = run.player.relics.filter(id => isRelicForCharacter(id, run.character));
  run.player.gold += (run.player.relics.length - legalRelics.length) * 60;
  run.player.relics = legalRelics;
  if (!legalRelics.includes("reset") && run.player.resetCharges !== undefined) run.player.resetCharges = 0;
  if (run.reward?.relic && !isRelicForCharacter(run.reward.relic, run.character)) {
    run.reward.relic = rewardRelics(legalRelics)[0] ?? null;
    if (!run.reward.relic) run.reward.gold += 60;
  }
  if (run.shop && !isRelicForCharacter(run.shop.relic, run.character)) {
    const replacement = rewardRelics(legalRelics)[0];
    run.shop.relic = replacement ?? "heart";
    if (!replacement) run.shop.relicSold = true;
  }
  if (run.quiz?.trial?.reward) run.quiz.trial.reward = trialReward(run);
}
