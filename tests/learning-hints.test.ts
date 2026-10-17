import { describe, expect, it } from "vitest";
import { CASES, CASE_BY_ID } from "../src/learning-cases";
import { caseHint, trialHint, practiceHint } from "../src/learning-hints";
import { LESSONS } from "../src/content";
import { TRIALS, trialQuestionAt, type TrialQuestion } from "../src/trials";
import { LEGACY_TRIALS } from "../src/trial-bank-v1";
import { ENGINEERING_TRIALS } from "../src/trial-bank";
import { practiceQuestion } from "../src/beginner-content";

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

describe("知识试炼与图鉴练习的思路提示", () => {
  it("当前试炼逐题复用代码阅读方向，乱序与换题后仍匹配实际题目", () => {
    for (const trial of ENGINEERING_TRIALS) {
      for (const q of trial.questions) {
        expect(trialHint(q).focus).toBe(caseHint(CASE_BY_ID[`code-v2-${q.id}`], "action").focus);
      }
    }
    const trial = ENGINEERING_TRIALS.find(t => t.id === "checkpoint-write")!;
    const quiz = { lessonId: "memory", selected: null, correct: null, boss: false,
      trial: { id: trial.id, revision: 2, step: 0, answers: [], reward: null, order: [2,0,1], optionOrders: [[2,0,1],[1,2,0],[0,1,2]] } };
    const first = trialQuestionAt(quiz, 0), next = trialQuestionAt(quiz, 1);
    expect(trialHint(first)).toEqual(trialHint(trial.questions[2]));
    expect(trialHint(next)).toEqual(trialHint(trial.questions[0]));
    expect(trialHint(first).focus).not.toBe(trialHint(next).focus);
  });
  it("提示生成不读取正确答案、选项或作答后解析", () => {
    const original = TRIALS[0].questions[0], q = { ...original };
    for (const key of ["correct", "options", "explanation", "optionReasons"]) {
      Object.defineProperty(q, key, { get() { throw new Error(`Hint read answer field: ${key}`); } });
    }
    expect(trialHint(q)).toEqual(trialHint(original));
  });
  it("31 个图鉴问题有不同思路，不复述答案或直接算出概率结果", () => {
    expect(new Set(LESSONS.map(l => practiceHint(l.id).focus)).size).toBe(LESSONS.length);
    for (const l of LESSONS) {
      const hint = practiceHint(l.id), text = hint.focus + hint.method;
      expect(hint.focus.length).toBeGreaterThan(10);
      expect(hint.method).toBeTruthy();
      const p=practiceQuestion(l.id);
      expect(text).not.toContain(p.options[p.correct]);
      expect(text).not.toContain(l.explanation);
      expect(text).not.toMatch(/正确(答案|选项)|选[择]?\s*[ABC]/);
    }
    expect(practiceHint("pass").focus).not.toMatch(/7[.．]8%|0[.．]078|0[.．]6\s*\*\*/);
  });
  it("旧试炼与单题存档也能获得符合原题的提示", () => {
    for (const q of LEGACY_TRIALS.flatMap(t => t.questions)) {
      const hint = trialHint(q);
      expect(typeof hint.focus).toBe("string");
      expect(hint.focus.length).toBeGreaterThan(15);
      expect(hint.focus + hint.method).not.toContain(q.options[q.correct]);
    }
    const basic: TrialQuestion = { ...LESSONS[0], lessonId: "agent", code: "" };
    expect(trialHint(basic).focus).toBeTruthy();
    expect(trialHint(LEGACY_TRIALS[0].questions[0]).focus).not.toBe(trialHint(LEGACY_TRIALS[0].questions[1]).focus);
  });
});
