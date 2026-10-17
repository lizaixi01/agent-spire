import { modelSprite, type ModelId } from "./models";
export function heroArt(color = "#80cbbd", model?: ModelId): string {
  const selected =
    model ??
    (color === "#d4a66a"
      ? "claude"
      : color === "#b69ac7"
        ? "deepseek"
        : "openai");
  return `<span class="hero-art pixel-figure">${modelSprite(selected)}</span>`;
}
export function enemyArt(kind = "wisp", _uid = "enemy"): string {
  const col = kind === "boss" ? 2 : kind === "golem" ? 1 : 0;
  return `<span class="enemy-art pixel-figure ${kind}" aria-hidden="true"><span class="encounter-sprite" style="--sprite-x:${(col / 3) * 100}%;--sprite-y:100%"></span></span>`;
}
