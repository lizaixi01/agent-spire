import { describe, expect, it } from "vitest";
import { CARDS } from "../src/cards";
import { cardIllustration, CARD_ILLUSTRATIONS } from "../src/card-art";

describe("用图片表达卡牌知识", () => {
  it("全部卡牌都有独立的概念插图，保持原有教材与数值", () => {
    expect(CARDS).toHaveLength(73);
    expect(
      new Set(CARDS.map((c) => CARD_ILLUSTRATIONS[c.id]?.scene)).size,
    ).toBe(CARDS.length);
    for (const card of CARDS) {
      const art = cardIllustration(card.id);
      expect(art).toContain('role="img"');
      expect(art).toContain('aria-label="');
      expect(art).not.toMatch(/model-party|model-sprite|model-logo/);
      expect(art).not.toMatch(
        /background-image|cards-cognition|cards-practice/,
      );
      expect(art).toContain("<svg");
      expect(art).toContain("crispEdges");
    }
  });
  it("上下文、检索和工具调用具有不同且可读的图意", () => {
    expect(cardIllustration("defend")).toContain("上下文窗口");
    expect(cardIllustration("rag")).toContain("证据");
    expect(cardIllustration("strike")).toContain("工具调用");
    expect(cardIllustration("memory")).toContain("记忆");
  });
});
