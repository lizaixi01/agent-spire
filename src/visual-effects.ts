import { RELICS, statsFor, type Card } from "./cards";
import { icon } from "./icons";
import type { TrialReward } from "./trials";
import { cardIllustration } from "./card-art";
import type { CombatFeedback } from "./combat-feedback";
import type { Impact } from "./impact";

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

export function showCombatEffects(
  feedback: CombatFeedback[],
  positions: CombatPositions,
  card?: Card,
  targetId = "",
  impact?: Impact,
): void {
  let layer = document.querySelector<HTMLElement>(".combat-fx");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "combat-fx";
    layer.setAttribute("aria-hidden", "true");
    document.body.append(layer);
  }
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const spawn = (
    cls: string,
    point: Point,
    text = "",
    delay = 0,
  ): HTMLElement => {
    while (layer!.children.length >= 24) layer!.firstElementChild?.remove();
    const node = document.createElement("span");
    node.className = `${cls}${reduced ? " reduced" : ""}`;
    node.textContent = text;
    node.style.cssText = `left:${point.x}px;top:${point.y}px;--delay:${delay}ms`;
    layer!.append(node);
    node.addEventListener("animationend", () => node.remove(), { once: true });
    window.setTimeout(() => node.remove(), 1400);
    return node;
  };
  const type = card ? statsFor(card).type : "skill";
  const arena = document.querySelector<HTMLElement>(".combat-stage");
  if (arena && impact?.cue) arena.dataset.reaction = impact.cue;
  const field = document.querySelector<HTMLElement>(".battlefield");
  if (field && impact?.cue) field.dataset.reaction = impact.cue;
  if (arena && impact?.shake && !reduced) {
    const s = impact.shake;
    arena.animate(
      [
        { transform: "translate(0,0)" },
        { transform: `translate(${-s}px,${s * .35}px)` },
        { transform: `translate(${s}px,${-s * .4}px)` },
        { transform: `translate(${-s * .8}px,${s * .25}px)` },
        { transform: `translate(${s * .6}px,${-s * .2}px)` },
        { transform: `translate(${-s * .3}px,2px)` },
        { transform: "translate(0,0)" },
      ],
      { duration: s >= 16 ? 430 : 220, easing: "steps(1)" },
    );
    try {
      navigator.vibrate?.(s >= 16 ? [35, 25, 65] : 20);
    } catch {
      /* Screen feedback remains available without a vibration device. */
    }
  }
  const player = positions.fighters.get("player");
  if (player && impact?.incoming.length) {
    for (const [i, action] of impact.incoming.entries()) {
      const attacker = [...document.querySelectorAll<HTMLElement>(".enemy-fighter")].find(e => e.dataset.id === action.enemyId);
      if (!reduced && ["attack","heavy"].includes(action.kind)) attacker?.animate([
        { translate: "0 0" }, { translate: "-38px 0", filter: "brightness(1.5)" }, { translate: "0 0" },
      ], { duration: 340, delay: i * 70, easing: "steps(3)" });
    }
    if (impact.playerDamage) {
      spawn("fx-number player-warning", { x: player.x, y: player.y - 115 }, `受到 ${impact.playerDamage} 点伤害`);
      if (!reduced) {
        spawn("fx-incoming-slash", player);
        spawn("fx-hurt-vignette", { x: 0, y: 0 });
        document.querySelector(".hp-stat")?.animate([{ background: "#e25555", color: "#fff" }, { background: "transparent" }], { duration: 1000 });
      }
    } else if (impact.absorbed) {
      spawn("fx-number player-guard", { x: player.x, y: player.y - 115 }, "完全格挡");
      if (!reduced) spawn("fx-shield", player);
    } else if (impact.incoming.some(a => a.kind === "weaken"))
      spawn("fx-number player-warning", { x: player.x, y: player.y - 115 }, "受到虚弱 · 攻击降低");
  }
  const destination = positions.fighters.get(
    type === "attack" ? targetId : "player",
  );
  if (card && destination && !reduced) {
    const origin =
      positions.card ?? positions.fighters.get("player") ?? destination;
    const cast = spawn(`fx-cast ${type}`, origin);
    cast.innerHTML = cardIllustration(card.defId);
    cast.style.setProperty("--dx", `${destination.x - origin.x}px`);
    cast.style.setProperty("--dy", `${destination.y - origin.y}px`);
    spawn(
      type === "attack"
        ? "fx-slash"
        : type === "power"
          ? "fx-power"
          : "fx-shield",
      destination,
      "",
      160,
    );
  }
  const offsets = new Map<string, number>();
  for (const effect of feedback) {
    const point = positions.fighters.get(effect.target);
    if (!point) continue;
    const offset = offsets.get(effect.target) ?? 0;
    offsets.set(effect.target, offset + 1);
    spawn(
      `fx-number ${effect.kind}`,
      { x: point.x, y: point.y - 45 - offset * 29 },
      effect.text,
      reduced ? 0 : 100,
    );
    if (effect.kind === "damage" && !reduced) spawn("fx-hit", point);
    if (effect.kind === "damage" && !reduced) {
      const fighter =
        effect.target === "player"
          ? document.querySelector(".player-fighter")
          : [...document.querySelectorAll<HTMLElement>(".enemy-fighter")].find(
              (e) => e.dataset.id === effect.target,
            );
      fighter?.animate(
        [
          { translate: "0 0", filter: "brightness(1)" },
          {
            translate: effect.target === "player" ? "-7px 0" : "9px 0",
            filter: "brightness(1.8)",
          },
          { translate: "-3px 0", filter: "brightness(1.15)" },
          { translate: "0 0", filter: "brightness(1)" },
        ],
        { duration: 230, easing: "steps(3)" },
      );
    }
  }
  for (const id of impact?.broken ?? []) {
    const point = positions.fighters.get(id);
    if (point)
      spawn("fx-number guard-break", { x: point.x, y: point.y - 88 }, "破防");
  }
  if (impact?.label && destination)
    spawn(
      "fx-number chain",
      { x: destination.x, y: destination.y - 120 },
      impact.label,
    );
  for (const id of impact?.kills ?? []) {
    const point = positions.fighters.get(id);
    if (!point) continue;
    spawn("fx-number finisher", { x: point.x, y: point.y - 80 }, "击破");
    const fighter = [
      ...document.querySelectorAll<HTMLElement>(".enemy-fighter"),
    ].find((e) => e.dataset.id === id);
    if (fighter) {
      fighter.classList.add("defeating");
      const bar = fighter.querySelector<HTMLElement>(".enemy-health > i");
      const hp = fighter.querySelector<HTMLElement>(".enemy-health > span");
      if (bar) bar.style.width = "0%";
      if (hp) hp.textContent = "0";
    }
    if (!reduced) spawn("fx-shatter", point);
  }
  if (impact?.cue === "victory") {
    const page = document.querySelector<HTMLElement>(".battle-page");
    if (page) page.dataset.resolving = "victory";
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      '.hand .game-card, [data-action="end-turn"]',
    ))
      button.disabled = true;
    spawn(
      reduced ? "fx-number" : "fx-victory",
      { x: innerWidth / 2, y: innerHeight * 0.36 },
      "战斗胜利",
      200,
    );
  }
}

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
