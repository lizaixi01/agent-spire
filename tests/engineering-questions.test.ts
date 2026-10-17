import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { availableNodes, enterNode, type Run } from "../src/engine";
import { decodeRun, encodeRun } from "../src/save";
import { TRIALS, trialQuestion, trialQuestionAt } from "../src/trials";
import { chapterRun } from "./fixtures";

const topics = new Set(["checkpoint", "memory", "compaction"]);

describe("有工程区分度的实现试炼", () => {
  it("三主题各有代码追踪、排错和取舍题；每个干扰项有独立原因", () => {
    for (const topic of topics) {
      const questions = TRIALS.filter(t => t.topic === topic).flatMap(t => t.questions);
      expect(questions.length).toBeGreaterThanOrEqual(12);
      expect(new Set(questions.map(q => q.kind))).toEqual(new Set(["trace", "debug", "tradeoff"]));
    }
    for (const question of TRIALS.flatMap(t=>t.questions)) {
      expect(question.code).not.toContain("???");
      expect(question.code.split("\n").length).toBeGreaterThanOrEqual(4);
      expect(question.optionReasons).toHaveLength(3);
      expect(new Set(question.optionReasons).size).toBe(3);
      expect(question.codeLanguage).toBe("python");
    }
  });

  it("题面 Python 可执行，故障现象与独立算出的结果相同", () => {
    const outputs = JSON.parse(execFileSync("python", ["-c", [
      "import json,sys,io,contextlib",
      "items=json.load(sys.stdin); result={}",
      "for item in items:",
      " out=io.StringIO()",
      " with contextlib.redirect_stdout(out): exec(compile(item['code'],item['id'],'exec'),{})",
      " result[item['id']]=out.getvalue().strip()",
      "print(json.dumps(result,ensure_ascii=False))",
    ].join("\n")], { input: JSON.stringify(TRIALS.flatMap(t=>t.questions)), encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" }, timeout: 10000 }));
    expect(outputs["checkpoint-boundary"]).toBe("4");
    expect(outputs["checkpoint-alias"]).toBe("2 2");
    expect(outputs["memory-late-arrival"]).toBe("Beijing");
    expect(outputs["memory-batch-deadline"]).toBe("False");
    expect(outputs["compaction-reserve"]).toBe("False True");
    expect(outputs["compaction-breaker"]).toBe("3");
    expect(outputs["checkpoint-publish"]).toBe("4");
    expect(outputs["checkpoint-determinism"]).toBe("20 24");
    expect(outputs["memory-filter-topk"]).toBe("0 no memory");
    expect(outputs["compaction-prefix"]).toBe("2");
  });

  it("新试炼只抽工程题；选项重排时理由跟随选项，作答前不改变掌握度", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const start = chapterRun("scholar", seed,3), node = availableNodes(start)[0];
      node.kind = "quiz"; node.lessonId = "memory";
      const run = enterNode(start,node.id);
      expect(run.quiz!.trial!.revision).toBe(2);
      expect(run.mastery).toEqual({});
      for (let step = 0; step < 3; step++) {
        const q = trialQuestionAt(run.quiz!,step);
        const t = run.quiz!.trial!;
        const source = TRIALS.find(x => x.id === t.id)!.questions[t.order![step]];
        expect(q.optionReasons).toEqual(t.optionOrders![step].map(i => source.optionReasons![i]));
        expect(q.optionReasons![q.correct]).toBe(source.optionReasons![source.correct]);
      }
      expect(decodeRun(encodeRun(run))).toEqual(run);
    }
  });

  it("题库升级不改写旧试炼已答内容，也不让旧存档丢失", () => {
    const run = chapterRun("scholar",42,3);
    run.screen = "quiz";
    run.quiz = { lessonId:"memory",boss:false,selected:1,correct:true,
      trial:{id:"checkpoint-write",step:0,answers:[1],reward:null,order:[0,1,2],optionOrders:[[0,1,2],[0,1,2],[0,1,2]]} };
    const saved = decodeRun(encodeRun(run));
    expect(saved).not.toBeNull();
    expect(trialQuestion(saved!.quiz!).question).toBe("会话结束后，事实应该先写到哪里？");
    const corrupt: Run = structuredClone(run);
    corrupt.quiz!.trial!.revision = 900;
    expect(decodeRun(encodeRun(corrupt))).toBeNull();
  });
});
