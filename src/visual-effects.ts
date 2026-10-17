import { RELICS } from "./cards";
import { icon } from "./icons";
import type { TrialReward } from "./trials";

interface Point {
  x: number;
  y: number;
}
export interface CombatPositions {
  fighters: Map<string, Point>;
  card?: Point;
}
const center = (element: Element): Point => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.5 };
};
export function capturePositions(cardId?: string): CombatPositions {
  const fighters = new Map<string, Point>();
  const player = document.querySelector(".player-fighter");
  if (player) fighters.set("player", center(player));
  for (const enemy of document.querySelectorAll<HTMLElement>(".enemy-fighter"))
    fighters.set(enemy.dataset.id!, center(enemy));
  const card = [
    ...document.querySelectorAll<HTMLElement>('[data-action="play"]'),
  ].find((e) => e.dataset.id === cardId);
  return { fighters, card: card ? center(card) : undefined };
}

export { showCombatEffects, clearCombatEffects } from "./combat-effects";

export function showTrialCelebration(perfect: boolean, reward?: TrialReward): void {
  document.querySelector(".trial-celebration")?.remove();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const layer = document.createElement("div");
  layer.className = `trial-celebration ${perfect ? "perfect" : "passed"} ${reduced ? "reduced" : ""}`;
  layer.setAttribute("aria-hidden", "true");
  const banner = document.createElement("div");
  banner.className = "trial-celebration-banner";
  banner.textContent = perfect ? "完 美 通 关" : "试 炼 通 过";
  layer.append(banner);
  if (reward) {
    const medallion = document.createElement("div");
    medallion.className = "trial-celebration-medallion";
    medallion.innerHTML = icon(reward.relic ? RELICS[reward.relic].icon : "flask", "", 60);
    const loot = document.createElement("div");
    loot.className = "trial-celebration-loot";
    loot.textContent = `+${reward.gold} 金币 · ${reward.relic ? RELICS[reward.relic].name : "能量补给"}`;
    layer.append(medallion, loot);
  }
  if (!reduced) for (let i = 0; i < 28; i++) {
    const particle = document.createElement("i");
    const angle = i / 28 * Math.PI * 2;
    particle.style.cssText = `--x:${Math.cos(angle) * (160 + i % 4 * 45)}px;--y:${Math.sin(angle) * (160 + i % 4 * 45)}px;--delay:${i % 4 * 35}ms`;
    layer.append(particle);
  }
  document.body.append(layer);
  if (!reduced) document.querySelector(".quiz-sheet")?.animate([
    { transform: "translateY(0)" }, { transform: "translateY(-9px)" }, { transform: "translateY(3px)" }, { transform: "translateY(0)" },
  ], { duration: 350, easing: "steps(2)" });
  window.setTimeout(() => layer.remove(), 1800);
}
