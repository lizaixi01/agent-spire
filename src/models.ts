import type { CharacterId } from "./cards";
export type ModelId = "openai" | "claude" | "deepseek";
export interface Model {
  id: ModelId;
  name: string;
  col: number;
  row: number;
  color: string;
  source: string;
}
export const MODELS: Model[] = [
  {
    id: "openai",
    name: "OpenAI",
    col: 0,
    row: 0,
    color: "#91d4ac",
    source: "https://openai.com/brand/",
  },
  {
    id: "claude",
    name: "Claude",
    col: 2,
    row: 0,
    color: "#ec9e69",
    source: "https://claude.com/",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    col: 3,
    row: 0,
    color: "#73a7e4",
    source: "https://www.deepseek.com/",
  },
];
export const modelForCharacter = (character: CharacterId): ModelId =>
  (({ scholar: "openai", engineer: "claude", weaver: "deepseek" }) as const)[
    character
  ];
export function modelSprite(model: ModelId, cls = ""): string {
  const m = MODELS.find((m) => m.id === model) ?? MODELS[0];
  return `<span class="model-sprite ${cls}" data-model="${m.id}" role="img" aria-label="${m.name} Q版形象" style="--sprite-x:${(m.col / 3) * 100}%;--sprite-y:${m.row * 100}%;--model-color:${m.color}"></span>`;
}
// Cosmetic pixel interpretations, unrelated to actual model performance.
const glyphs: Record<ModelId, string[]> = {
  openai: [
    "0000011111000000",
    "0001100000110000",
    "0010011111001000",
    "0100100000100100",
    "0101001101010100",
    "1010010010101010",
    "1001010011010010",
    "1010101100101010",
    "1010110010101010",
    "1001001100100010",
    "0101010010100100",
    "0100100001000100",
    "0010011111001000",
    "0001100000110000",
    "0000011111000000",
    "0000000000000000",
  ],
  claude: [
    "0000001100000000",
    "0100001100000100",
    "0011001100110000",
    "0001111111000000",
    "1000111110000010",
    "0111111111111100",
    "0001111111000000",
    "1111111111111111",
    "0001111111000000",
    "0111111111111100",
    "1000111110000010",
    "0001111111000000",
    "0011001100110000",
    "0100001100000100",
    "0000001100000000",
    "0000001100000000",
  ],
  deepseek: [
    "0000000000000000",
    "0000000100000000",
    "0000000110000000",
    "0000000011000000",
    "0000011111110000",
    "0001111111111100",
    "0011111111111110",
    "0111111111111110",
    "1111011111111110",
    "1111111111111100",
    "0111111111111001",
    "0011111111110011",
    "0001111111111110",
    "0000011111111000",
    "0000000000000000",
    "0000000000000000",
  ],
};
export function modelLogo(model: ModelId, size = 24): string {
  const m = MODELS.find((m) => m.id === model) ?? MODELS[0];
  const pixels = glyphs[m.id]
    .flatMap((row, y) =>
      [...row].flatMap((p, x) => (p === "1" ? [`M${x} ${y}h1v1h-1z`] : [])),
    )
    .join("");
  return `<svg class="model-logo" data-brand="${m.id}" width="${size}" height="${size}" viewBox="0 0 16 16" fill="${m.color}" shape-rendering="crispEdges" role="img" aria-label="${m.name}标志"><path d="${pixels}"/></svg>`;
}
