import { describe, expect, it } from "vitest";
import { BEGINNER_FOLLOW_UPS, BEGINNER_QUESTIONS, practiceQuestion } from "../src/beginner-content";
import { LESSONS } from "../src/content";
import { availableNodes, enterNode, answerQuiz, finishQuiz, answerLab } from "../src/engine";
import { caseForBattle, transferFor, CASE_BY_ID } from "../src/learning-cases";
import { trialQuestion, trialQuestionAt, trialScore } from "../src/trials";
import { ENGINEERING_TRIALS } from "../src/trial-bank";
import { decodeRun, encodeRun } from "../src/save";
import { chapterRun } from "./fixtures";

describe("零基础入门主线", () => {
  it("十章各六个短场景，先解释一个概念，不要求读代码或计算概率", () => {
    expect(BEGINNER_QUESTIONS).toHaveLength(60);
    for (let chapter=1;chapter<=10;chapter++) {
      const questions=BEGINNER_QUESTIONS.filter(q=>q.chapter===chapter);
      expect(questions).toHaveLength(6);
      expect(new Set(questions.map(q=>q.scene)).size).toBe(6);
      for (const q of questions) {
        expect(q.level).toBe("beginner"); expect(q.code).toBe("");
        expect(q.intro.length).toBeGreaterThan(20); expect(q.intro.length).toBeLessThan(120);
        expect((q.scene+q.question).length).toBeLessThan(120);
        expect(q.options).toHaveLength(3); expect(q.optionReasons).toHaveLength(3);
        expect(new Set(q.optionReasons).size).toBe(3);
        expect([q.question,q.scene,...q.options].join(" ")).not.toMatch(/\b(?:def|print|lambda|rollout|schema|through|seq)\b|\*\*|0\.6/);
      }
    }
    for (const l of LESSONS) expect(practiceQuestion(l.id).lessonId).toBe(l.id);
    expect(practiceQuestion("pass").question).not.toContain("概率");
    expect(practiceQuestion("agent").options[practiceQuestion("agent").correct]).toContain("读取文件");
  });
  it("后一关的题干和巩固题不能与更早关卡的题干相同", () => {
    const seen = new Set<string>();
    for (const q of BEGINNER_QUESTIONS) {
      const transfer = transferFor(CASE_BY_ID[`beginner-${q.id}`]);
      expect(seen.has(q.question), q.id).toBe(false);
      expect(seen.has(transfer.question), `${q.id} 的巩固题重复了更早的题干`).toBe(false);
      expect(transfer.question).not.toBe(q.question);
      expect(transfer.evidence).toBeTruthy();
      seen.add(q.question);
    }
    const followUps = Object.entries(BEGINNER_FOLLOW_UPS);
    expect(new Set(followUps.map(([, q]) => q.question)).size).toBe(followUps.length);
    for (const [parentId, q] of followUps) {
      const parent = BEGINNER_QUESTIONS.find(item => item.id === parentId);
      expect(parent?.lessonId).toBe(q.lessonId);
      expect(BEGINNER_QUESTIONS.some(item => item.question === q.question || item.scene === q.scene)).toBe(false);
      expect((q.scene + q.question).length).toBeLessThan(120);
      expect(new Set(q.optionReasons).size).toBe(3);
    }
  });
  it("新战斗、三步试炼与图鉴都接入入门内容，选项仍随机且可恢复", () => {
    for (let chapter=1;chapter<=10;chapter++) {
      const start=chapterRun("scholar",42,chapter), node=availableNodes(start)[0];
      const fight=enterNode(start,node.id), c=caseForBattle(fight), second=transferFor(c);
      expect(c.level).toBe("beginner"); expect(c.intro).toBeTruthy();
      expect(c.codeLanguage).toBeUndefined(); expect(second.level).toBe("beginner");
      expect(second.question).not.toBe(c.situation);
      node.kind="quiz";
      const quiz=enterNode(start,node.id);
      expect(quiz.quiz!.trial!.revision).toBe(3);
      for (let step=0;step<3;step++) expect(trialQuestionAt(quiz.quiz!,step).level).toBe("beginner");
      expect(decodeRun(encodeRun(quiz))).toEqual(quiz);
    }
  });
  it("巩固题换新后，已答旧档保留旧题与乱序答案；未答阶段使用新题并持久化版本", () => {
    const base = chapterRun("scholar", 42);
    const old = enterNode(base, availableNodes(base)[0].id);
    const parent = BEGINNER_QUESTIONS.find(q => q.id === "intro-react-feedback")!;
    const former = BEGINNER_QUESTIONS.find(q => q.id === "intro-react-error")!;
    old.battle!.lab = { caseId: `beginner-${parent.id}`, choice: 0, transfer: 0,
      order: [0, 1, 2], transferOrder: [2, 0, 1] };
    const restored = decodeRun(encodeRun(old))!;
    const originalTransfer = transferFor(caseForBattle(restored));
    expect(originalTransfer.question).toBe(former.question);
    expect(originalTransfer.correct).toBe(0);
    expect(originalTransfer.options[0]).toBe(former.options[former.correct]);
    expect(restored.player).toEqual(old.player);
    expect(decodeRun(encodeRun(restored))).toEqual(restored);

    old.battle!.lab!.transfer = null;
    const pending = decodeRun(encodeRun(old))!;
    const newTransfer = transferFor(caseForBattle(pending));
    expect(newTransfer.question).toBe(BEGINNER_FOLLOW_UPS[parent.id].question);
    const done = answerLab(pending, newTransfer.correct);
    expect(done.battle!.lab!.followUpVersion).toBe(1);
    expect(transferFor(caseForBattle(decodeRun(encodeRun(done))!))).toEqual(newTransfer);
    const malformed = structuredClone(done);
    Object.assign(malformed.battle!.lab!, { followUpVersion: 2 });
    expect(decodeRun(encodeRun(malformed))).toBeNull();
  });
  it("旧试炼只替换未答部分，已答题、成绩、资源与随机状态保持原样", () => {
    const run=chapterRun("scholar",42,3), original=ENGINEERING_TRIALS[0].questions[0];
    run.screen="quiz";
    run.quiz={lessonId:"memory",selected:null,correct:null,boss:false,trial:{id:"checkpoint-write",revision:2,step:1,answers:[original.correct],reward:null,order:[0,1,2],optionOrders:[[0,1,2],[0,1,2],[0,1,2]]}};
    const saved=decodeRun(encodeRun(run))!;
    expect(saved.player).toEqual(run.player); expect(saved.rng).toBe(run.rng);
    expect(saved.quiz!.trial!.answers).toEqual([original.correct]); expect(trialScore(saved.quiz!)).toBe(1);
    expect(trialQuestionAt(saved.quiz!,0)).toEqual(trialQuestionAt(run.quiz!,0));
    expect(trialQuestion(saved.quiz!).level).toBe("beginner");
    expect(decodeRun(encodeRun(saved))).toEqual(saved);
    let next=finishQuiz(answerQuiz(saved,trialQuestion(saved.quiz!).correct));
    next=answerQuiz(next,trialQuestion(next.quiz!).correct);
    expect(trialScore(next.quiz!)).toBe(3);
    expect(next.quiz!.trial!.reward?.gold).toBe(140);
  });
  it("旧战斗未答题可直接入门，已答第一步不重新判分，第二步继续简单题", () => {
    const start=chapterRun("scholar",22), run=enterNode(start,availableNodes(start)[0].id);
    const source=CASE_BY_ID["code-v2-agent-capability"];
    run.battle!.lab={caseId:source.id,choice:null,transfer:null,order:[0,1,2],transferOrder:[0,1,2]};
    const beginner=decodeRun(encodeRun(run))!;
    expect(caseForBattle(beginner).level).toBe("beginner");
    expect(beginner.player).toEqual(run.player); expect(beginner.rng).toBe(run.rng);
    run.battle!.lab.choice=source.correct;
    const partial=decodeRun(encodeRun(run))!;
    expect(caseForBattle(partial).situation).toBe(source.situation);
    expect(partial.battle!.lab!.choice).toBe(source.correct);
    expect(transferFor(caseForBattle(partial)).level).toBe("beginner");
    const done=answerLab(partial,transferFor(caseForBattle(partial)).correct);
    expect(done.mastery[source.lesson]).toBe(1);
    expect(decodeRun(encodeRun(done))).toEqual(done);
    run.battle!.lab.choice=(source.correct+1)%3;
    const wrong=decodeRun(encodeRun(run))!;
    const wrongDone=answerLab(wrong,transferFor(caseForBattle(wrong)).correct);
    expect(wrongDone.mastery[source.lesson] ?? 0).toBe(0);
    expect(wrongDone.player.gold).toBe(run.player.gold);
  });
  it("旧单题无须重开远征；拒绝跨章、未知或混用版本的入门引用", () => {
    const run=chapterRun("scholar",17);
    run.screen="quiz"; run.quiz={lessonId:"agent",selected:null,correct:null,boss:false};
    const saved=decodeRun(encodeRun(run))!;
    expect(trialQuestion(saved.quiz!).level).toBe("beginner");
    const cross=structuredClone(saved); cross.quiz!.beginnerQuestion=practiceQuestion("memory").id;
    expect(decodeRun(encodeRun(cross))).toBeNull();
    const bad=structuredClone(saved); bad.quiz!.beginnerQuestion="constructor";
    expect(decodeRun(encodeRun(bad))).toBeNull();
    const start=chapterRun("scholar",42,3), node=availableNodes(start)[0]; node.kind="quiz";
    const current=enterNode(start,node.id); current.quiz!.trial!.revision=2;
    expect(decodeRun(encodeRun(current))).toBeNull();
  });
});
