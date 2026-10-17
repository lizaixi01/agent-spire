import { statsFor, type Card } from "./cards";
import { cardIllustration } from "./card-art";
import type { CombatFeedback } from "./combat-feedback";
import type { Impact, ImpactBeat } from "./impact";
import type { CombatPositions } from "./visual-effects";

const timers = new Set<number>();
const animations = new Set<Animation>();
function later(at: number, action: () => void): void {
  const id = window.setTimeout(() => { timers.delete(id); if (!document.hidden) action(); }, at);
  timers.add(id);
}
function animate(element: Element | null, frames: Keyframe[], options: KeyframeAnimationOptions): void {
  if (!element?.isConnected) return;
  const animation = element.animate(frames, options);
  animations.add(animation);
  animation.onfinish = () => animations.delete(animation);
  animation.oncancel = () => animations.delete(animation);
}
export function clearCombatEffects(): void {
  for (const timer of timers) window.clearTimeout(timer);
  timers.clear();
  for (const animation of animations) animation.cancel();
  animations.clear();
  document.querySelector(".combat-fx")?.remove();
}
const fighterFor = (id: string): HTMLElement | null => id === "player"
  ? document.querySelector(".player-fighter")
  : [...document.querySelectorAll<HTMLElement>(".enemy-fighter")].find(e => e.dataset.id === id) ?? null;

export function showCombatEffects(feedback: CombatFeedback[], positions: CombatPositions,
  card?: Card, targetId = "", impact?: Impact): void {
  let layer = document.querySelector<HTMLElement>(".combat-fx");
  if (!layer) {
    layer = document.createElement("div"); layer.className = "combat-fx";
    layer.setAttribute("aria-hidden", "true"); document.body.append(layer);
  }
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const spawn = (cls: string, point: { x: number; y: number }, text = "", delay = 0): HTMLElement => {
    while (layer!.children.length >= 72) layer!.firstElementChild?.remove();
    const node = document.createElement("span");
    node.className = `${cls}${reduced ? " reduced" : ""}`;
    node.textContent = text;
    node.style.cssText = `left:${Math.round(point.x)}px;top:${Math.round(point.y)}px;--delay:${reduced ? 0 : delay}ms`;
    layer!.append(node);
    node.addEventListener("animationend", () => node.remove(), { once: true });
    later((reduced ? 0 : delay) + 1800, () => node.remove());
    return node;
  };
  const field = document.querySelector<HTMLElement>(".battlefield");
  if (field && impact?.cue) field.dataset.reaction = impact.cue;
  const beats = impact?.beats ?? [];
  const lastAt = beats.at(-1)?.at ?? 120;
  const type = card ? statsFor(card).type : "skill";
  const destination = positions.fighters.get(type === "attack" ? targetId : "player");
  if (card && destination && !reduced) {
    const origin = positions.card ?? positions.fighters.get("player") ?? destination;
    const cast = spawn(`fx-cast ${type} timed-cast`, origin);
    cast.innerHTML = cardIllustration(card.defId);
    cast.style.setProperty("--dx", `${destination.x - origin.x}px`);
    cast.style.setProperty("--dy", `${destination.y - origin.y}px`);
    cast.style.animationDuration = `${beats[0]?.at ?? 150}ms`;
    const player = fighterFor("player")?.querySelector(".hero-art") ?? null;
    animate(player, [{ translate: "0 0", scale: "1" }, { translate: "-14px 0", scale: ".93 1.04", offset: .6 },
      { translate: "20px 0", scale: "1.08 .96", offset: .8 }, { translate: "0 0", scale: "1" }],
    { duration: (beats[0]?.at ?? 150) + 140, easing: "ease-out" });
    if (!beats.length) spawn(type === "power" ? "fx-power" : "fx-shield", destination, "", 120);
  }

  // Freeze only the sprite at impact. State, saving, buttons and keyboard stay responsive.
  for (const [index, beat] of beats.entries()) {
    const point = positions.fighters.get(beat.target);
    if (!point) continue;
    const incoming = beat.target === "player";
    const fighter = fighterFor(beat.target);
    const art = fighter?.querySelector(incoming ? ".hero-art" : ".enemy-art") ?? null;
    if (beat.finisher) fighter?.classList.remove("slain");
    const health = fighter?.querySelector<HTMLElement>(".health-bar > i");
    const hpText = fighter?.querySelector<HTMLElement>(".health-bar > span");
    if (health && !beats.slice(0, index).some(b => b.target === beat.target)) {
      health.style.transition = "none";
      health.style.width = `${beat.hpBefore / beat.maxHp * 100}%`;
      if (hpText) hpText.textContent = `${beat.hpBefore} / ${beat.maxHp}`;
    }
    if (beat.attacker && !reduced) {
      const attacker = fighterFor(beat.attacker)?.querySelector(".enemy-art") ?? null;
      later(Math.max(0, beat.at - 140), () => animate(attacker, [
        { translate: "0 0" }, { translate: "14px 0", scale: ".96 1.04", offset: .35 },
        { translate: "-65px 0", scale: "1.12 .95", offset: .65 }, { translate: "0 0", scale: "1" },
      ], { duration: 340, easing: "cubic-bezier(.2,.8,.2,1)" }));
    }
    const text = beat.damage ? `−${beat.damage}` : beat.blocked ? `格挡 ${beat.blocked}` : incoming ? "已抵消" : "未穿透";
    const number = spawn(`fx-number hit-number ${beat.damage ? "damage" : "absorb"} ${beat.shake >= 28 ? "heavy" : ""} ${incoming ? "incoming" : ""}`,
      { x: point.x + (beats.length > 1 ? (index % 2 ? 32 : -24) : 0), y: point.y - 60 - index % 3 * 24 }, text, beat.at);
    number.dataset.hit = String(index + 1);
    number.dataset.target = beat.target;
    if (beat.damage && beat.blocked) spawn("fx-number absorb", { x: point.x, y: point.y + 8 }, `格挡 ${beat.blocked}`, beat.at);
    if (beat.breakGuard) spawn("fx-number guard-break", { x: point.x, y: point.y - 135 }, "破 盾", beat.at);
    if (beat.finisher) spawn("fx-number finisher", { x: point.x, y: point.y - 100 }, "击 破", beat.at + 75);
    if (incoming) spawn(`fx-number ${beat.damage ? "player-warning" : "player-guard"}`,
      { x: point.x, y: point.y - 130 }, beat.damage ? `受到 ${beat.damage} 点伤害` : beat.blocked ? "完全格挡" : "攻击已抵消", beat.at);
    if (!reduced) {
      const ring = spawn(`fx-impact-ring ${incoming && beat.damage ? "danger" : !beat.damage ? "guard" : ""} ${beat.shake >= 28 ? "heavy" : ""}`, point, "", beat.at);
      ring.innerHTML = '<svg viewBox="0 0 100 100"><path d="M30 4H70L96 30V70L70 96H30L4 70V30Z" fill="none" stroke="currentColor" stroke-width="4"/><path d="M32 11H68L89 32V68L68 89H32L11 68V32Z" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
      spawn(beat.damage ? (incoming ? "fx-incoming-slash" : "fx-slash impact-slash") : "fx-shield", point, "", beat.at);
      if (beat.damage) {
        spawn("fx-impact-core", point, "", beat.at);
        for (let i = 0; i < (beat.shake >= 28 ? 12 : 7); i++) {
          const spark = spawn(`fx-spark ${incoming ? "danger" : ""}`, point, "", beat.at);
          const angle = i * 2.399 + index;
          spark.style.setProperty("--sx", `${Math.cos(angle) * (80 + i * 10)}px`);
          spark.style.setProperty("--sy", `${Math.sin(angle) * (60 + i * 7)}px`);
          spark.style.setProperty("--angle", `${angle}rad`);
        }
      }
      if (incoming && beat.damage) spawn("fx-hurt-vignette", { x: 0, y: 0 }, "", beat.at);
      if (beat.breakGuard || beat.finisher) spawn("fx-shatter impact-shatter", point, "", beat.at);
    }
    later(reduced ? 0 : beat.at, () => {
      if (health?.isConnected) {
        // Animate the lost segment behind the real bar; never invent damage.
        const trail = document.createElement("b"); trail.className = "fx-health-trail";
        trail.style.width = `${beat.hpBefore / beat.maxHp * 100}%`;
        health.parentElement?.append(trail);
        health.style.width = `${beat.hpAfter / beat.maxHp * 100}%`;
        if (hpText) hpText.textContent = `${beat.hpAfter} / ${beat.maxHp}`;
        if (!reduced) animate(trail, [{ width: trail.style.width }, { width: trail.style.width, offset: .25 },
          { width: `${beat.hpAfter / beat.maxHp * 100}%` }], { duration: 420, fill: "forwards" });
        later(460, () => trail.remove());
      }
      if (!reduced) {
        punch(field, beat);
        const direction = incoming ? -1 : 1;
        const offset = Math.min(42, beat.shake * 1.1) * direction;
        const hold = beat.hold / (beat.hold + 220);
        animate(art, [
          { translate: `${offset}px -5px`, scale: "1.15 .86", filter: "brightness(2.8) saturate(.35)", offset: 0 },
          { translate: `${offset}px -5px`, scale: "1.15 .86", filter: "brightness(2.2)", offset: hold },
          { translate: `${-offset * .25}px 0`, scale: ".96 1.04", filter: "brightness(1.1)", offset: .7 },
          { translate: "0 0", scale: "1", filter: "brightness(1)" },
        ], { duration: beat.hold + 220, easing: "steps(2)" });
        if (incoming && beat.damage) animate(document.querySelector(".hp-stat"), [
          { background: "#d63854", color: "white", scale: "1.15" }, { background: "transparent", scale: "1" },
        ], { duration: 650 });
      }
      if (beat.finisher && fighter?.isConnected) {
        if (!reduced) later(beat.hold, () => fighter.classList.add("defeating"));
        else fighter.classList.add("slain");
      }
    });
  }
  const offsets = new Map<string, number>();
  for (const effect of feedback) {
    if ((effect.kind === "damage" || effect.kind === "absorb") && beats.some(b => b.target === effect.target)) continue;
    const point = positions.fighters.get(effect.target); if (!point) continue;
    const offset = offsets.get(effect.target) ?? 0; offsets.set(effect.target, offset + 1);
    spawn(`fx-number ${effect.kind}`, { x: point.x, y: point.y - 45 - offset * 30 }, effect.text,
      beats.length ? lastAt + 120 : 120);
    if (!reduced && ["energy", "mastery", "heal"].includes(effect.kind)) {
      spawn("fx-power resource-burst", point, "", beats.length ? lastAt + 120 : 120);
      const resource = document.querySelector(effect.kind === "energy" ? ".energy-orb" : ".player-fighter .health-bar");
      later(beats.length ? lastAt + 120 : 120, () => animate(resource, [
        { scale: "1.2", filter: "brightness(1.8)" }, { scale: "1", filter: "brightness(1)" },
      ], { duration: 360 }));
    }
  }
  if (impact?.label && destination) spawn("fx-number chain", { x: destination.x, y: destination.y - 165 }, impact.label, beats[0]?.at ?? 120);
  if (impact && impact.comboCount >= 2 && field) {
    document.querySelector(".fx-combo-meter")?.remove();
    const rect = field.getBoundingClientRect();
    spawn("fx-combo-meter", { x: Math.min(innerWidth - 95, rect.right - 60), y: rect.top + 40 }, `${impact.comboCount} 连奏`);
  }
  if (impact?.cue === "victory") {
    const page = document.querySelector<HTMLElement>(".battle-page");
    if (page) page.dataset.resolving = "victory";
    for (const button of document.querySelectorAll<HTMLButtonElement>('.hand .game-card,[data-action="end-turn"],[data-action="potion"]')) button.disabled = true;
    spawn(reduced ? "fx-number" : "fx-victory", { x: innerWidth / 2, y: innerHeight * .35 }, "战 斗 胜 利", lastAt + 180);
    if (!reduced) spawn("fx-victory-halo", { x: innerWidth / 2, y: innerHeight * .35 }, "", lastAt + 180);
  }
}

function punch(field: HTMLElement | null, beat: ImpactBeat): void {
  const s = beat.shake;
  // Move the stage scenery and fighters, keeping cards and controls still.
  animate(field, [
    { translate: `${-s}px ${s * .35}px`, rotate: "-.5deg", offset: 0 },
    { translate: `${-s}px ${s * .35}px`, rotate: "-.5deg", offset: .09 },
    { translate: `${s}px ${-s * .4}px`, rotate: ".5deg", offset: .2 },
    { translate: `${-s * .7}px ${s * .2}px`, rotate: "-.3deg", offset: .36 },
    { translate: `${s * .45}px ${-s * .2}px`, rotate: ".2deg", offset: .54 },
    { translate: `${-s * .2}px 2px`, rotate: "0deg", offset: .73 },
    { translate: "0 0", rotate: "0deg" },
  ], { duration: beat.hold + 230, easing: "steps(1)" });
  try { navigator.vibrate?.(beat.shake >= 28 ? [30, 18, 55] : 25); } catch { /* Optional device feedback. */ }
}
