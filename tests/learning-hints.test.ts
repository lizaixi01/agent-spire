import { describe, expect, it } from "vitest";
import { CASES, CASE_BY_ID } from "../src/learning-cases";
import { caseHint } from "../src/learning-hints";

describe("按需查看工程决策提示", () => {
  it("截图中的观察题定位真实输入，第二步改为核对同事的解释", () => {
    const c = CASE_BY_ID["code-v2-agent-observation"], original = structuredClone(c);
    const first = caseHint(c, "action"), second = caseHint(c, "transfer");
    for (const name of ["decide(messages)", "context", "working_dir"]) expect(first.focus).toContain(name);
    expect(second.method).toContain("同事方案");
    expect(first.method).not.toBe(second.method);
    expect(first.focus).not.toContain(c.options[c.correct]);
    expect(c).toEqual(original);
  });
  it("每道当前代码题都有对应的观察方向，旧案例也能安全得到提示", () => {
    const current = CASES.filter(c => c.id.startsWith("code-v2-"));
    expect(current.length).toBeGreaterThanOrEqual(84);
    expect(new Set(current.map(c => caseHint(c, "action").focus)).size).toBe(current.length);
    for (const c of CASES) {
      const hint = caseHint(c, "action");
      expect(hint.focus.length).toBeGreaterThan(15);
      if (c.id.startsWith("code-v2-")) expect(hint.focus).not.toContain("围绕「");
    }
  });
  it("选项乱序不会改变提示内容，也不会给出正确选项序号", () => {
    const c = CASE_BY_ID["code-v2-agent-observation"];
    const shuffled = { ...c, options: [...c.options].reverse() as typeof c.options, correct: 2 - c.correct };
    for (const phase of ["action", "transfer"] as const) {
      const before = caseHint(c, phase), after = caseHint(shuffled, phase);
      expect(after).toEqual(before);
      expect(`${after.focus}${after.method}`).not.toMatch(/正确(答案|选项)|选[择]?\s*[ABC]/);
    }
  });
});
