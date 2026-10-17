import { describe, expect, it } from "vitest";
import { availableNodes, enterNode, answerLab, type Run } from "../src/engine";
import { CASES, caseForBattle, transferFor } from "../src/learning-cases";
import { LESSON_BY_ID } from "../src/content";
import { decodeRun, encodeRun } from "../src/save";
import { chapterRun } from "./fixtures";

describe("战斗侧栏的工程决策题池", () => {
  it("包括第十章在内，每章连续六场不重复题面或代码，不靠换选项冒充新题", () => {
    for (let chapter=1;chapter<=10;chapter++) {
      let run=chapterRun("scholar",71,chapter);
      const questions=new Set<string>(), evidence=new Set<string>();
      for(let i=0;i<6;i++) {
        const ready: Run={...run,screen:"map",battle:null,position:null,visited:[]};
        run=enterNode(ready,availableNodes(ready)[0].id);
        const c=caseForBattle(run), transfer=transferFor(c);
        expect(LESSON_BY_ID[c.lesson].chapter).toBe(chapter);
        expect(transfer.code).toBeTruthy();
        questions.add(c.situation);evidence.add(c.evidence);
        const restored=decodeRun(encodeRun(run))!;
        expect(caseForBattle(restored)).toEqual(c);
        const completed=answerLab(answerLab(run,c.correct),transfer.correct);
        expect(completed.battle!.lab!.transfer).not.toBeNull();
      }
      expect(questions.size,`chapter ${chapter}`).toBe(6);
      expect(evidence.size,`chapter ${chapter}`).toBe(6);
    }
  });
  it("新侧栏题包含可读代码，旧 caseId 仍可恢复", () => {
    for(let chapter=1;chapter<=10;chapter++)
      expect(CASES.filter(c=>c.codeLanguage==="python" && LESSON_BY_ID[c.lesson].chapter===chapter).length).toBeGreaterThanOrEqual(6);
    const run=chapterRun("scholar",42);
    const entered=enterNode(run,availableNodes(run)[0].id);
    entered.battle!.lab={caseId:"missing-file",choice:null,transfer:null};
    const restored=decodeRun(encodeRun(entered));
    expect(restored).not.toBeNull();
    expect(caseForBattle(restored!).evidence).toContain("不存在");
  });
});
