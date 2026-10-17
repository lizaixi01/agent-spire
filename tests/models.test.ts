import { describe, expect, it } from "vitest";
import { MODELS, modelForCharacter, modelSprite } from "../src/models";
import { CHARACTERS } from "../src/cards";

describe("模型外观与教材分离", () => {
  it("只提供观测者、铸序师和织忆者对应的三个固定形象", () => {
    expect(MODELS.map((m) => m.name)).toEqual(["OpenAI", "Claude", "DeepSeek"]);
    expect(new Set(MODELS.map((m) => `${m.col}-${m.row}`)).size).toBe(3);
    expect(modelSprite("deepseek")).toContain('data-model="deepseek"');
    expect(modelSprite("deepseek")).toContain("--sprite-x:100%");
  });
  it("角色与形象一一对应，不再有独立的外观组合", () => {
    expect(CHARACTERS.map((c) => modelForCharacter(c.id))).toEqual([
      "openai",
      "claude",
      "deepseek",
    ]);
  });
});
