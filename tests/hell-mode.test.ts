import { describe, expect, it } from "vitest";
import { answerLab, answerQuiz, availableNodes, combatUnlocked, createRun, endTurn, enterNode, finishQuiz, playCard, usePotion } from "../src/engine";
import { LESSONS, LESSON_BY_ID } from "../src/content";
import { caseForBattle, transferFor } from "../src/learning-cases";
import { practiceForMode, trialDefinition, trialQuestion, trialsForMode } from "../src/trials";
import { decodeRun, encodeRun } from "../src/save";
import { chapterRun } from "./fixtures";

describe("可选地狱题目模式", () => {
  it.each(["scholar", "engineer", "weaver"] as const)("%s 选择地狱模式仅切换题目，不改战斗基础资源与地图", character => {
    const normal = createRun(character, 42), hell = createRun(character, 42, "hell");
    expect(hell.learningMode).toBe("hell");
    expect(hell.player).toEqual(normal.player);
    expect(hell.deck).toEqual(normal.deck);
    expect(hell.map).toEqual(normal.map);
    expect(decodeRun(encodeRun(hell))).toEqual(hell);
  });

  it("十章战斗两步都为本章代码题，未答和部分作答重载不会降回入门题", () => {
    for (let chapter = 1; chapter <= 10; chapter++) {
      const base = chapterRun("weaver", 42, chapter);
      base.learningMode = "hell";
      let run = enterNode(base, availableNodes(base)[0].id);
      const first = caseForBattle(run), second = transferFor(first);
      expect(first.id).toMatch(/^code-v2-/);
      expect(LESSON_BY_ID[first.lesson].chapter).toBe(chapter);
      expect(first.codeLanguage).toBe("python");
      expect(second.codeLanguage).toBe("python");
      expect(second.question).not.toBe(first.situation);
      expect(combatUnlocked(run)).toBe(false);
      expect(decodeRun(encodeRun(run))).toEqual(run);
      run = answerLab(run, first.correct);
      expect(combatUnlocked(run)).toBe(false);
      run = decodeRun(encodeRun(run))!;
      expect(transferFor(caseForBattle(run))).toEqual(second);
      expect(run.battle!.lab!.beginnerTransfer).toBeUndefined();
      run = answerLab(run, second.correct);
      expect(combatUnlocked(run)).toBe(true);
      expect(run.mastery[first.lesson]).toBe(1);
      expect(decodeRun(encodeRun(run))).toEqual(run);
      expect(answerLab(run, second.correct)).toBe(run);
    }
  });

  it("十章三步试炼使用进阶题且乱序解析对应，刷新、领奖和过幕保留难度", () => {
    for (let chapter = 1; chapter <= 10; chapter++) {
      const base = chapterRun("scholar", 17, chapter);
      base.learningMode = "hell";
      const node = availableNodes(base)[0]; node.kind = "quiz";
      let run = enterNode(base, node.id);
      run.quiz!.boss = true;
      expect(run.quiz!.trial!.revision).toBe(4);
      const seen = new Set<string>();
      for (let step = 0; step < 3; step++) {
        run = decodeRun(encodeRun(run))!;
        const q = trialQuestion(run.quiz!);
        expect(q.chapter).toBe(chapter);
        expect(q.codeLanguage).toBe("python");
        expect(q.level).not.toBe("beginner");
        expect(q.optionReasons).toHaveLength(3);
        const t = run.quiz!.trial!, original = trialDefinition(run.quiz!).questions[t.order![step]];
        expect(q.optionReasons).toEqual(t.optionOrders![step].map(i => original.optionReasons![i]));
        expect(q.optionReasons![q.correct]).toBe(original.optionReasons![original.correct]);
        seen.add(q.id!);
        expect(run.quiz!.trial!.introOverrides).toBeUndefined();
        run = answerQuiz(run, q.correct);
        expect(decodeRun(encodeRun(run))).toEqual(run);
        run = finishQuiz(run);
      }
      expect(seen.size).toBe(3);
      expect(run.learningMode).toBe("hell");
      expect(run.screen).toBe(chapter === 10 ? "victory" : "map");
      expect(decodeRun(encodeRun(run))).toEqual(run);
    }
  });

  it("全部知识点有代码练习，两种难度不会混用题库；旧档缺省仍是入门", () => {
    for (const lesson of LESSONS) {
      const q = practiceForMode(lesson.id, "hell");
      expect(q.codeLanguage).toBe("python");
      expect(q.code).toBeTruthy();
      expect(q.lessonId).toBe(lesson.id);
      expect(practiceForMode(lesson.id).level).toBe("beginner");
    }
    expect(trialsForMode("hell").flatMap(t => t.questions)).toHaveLength(90);
    const legacy = createRun("scholar", 42);
    delete legacy.learningMode;
    const restored = decodeRun(encodeRun(legacy))!;
    expect(caseForBattle(enterNode(restored, availableNodes(restored)[0].id)).level).toBe("beginner");
    for (const invalid of ["nightmare", 1, null]) {
      expect(decodeRun(JSON.stringify({ ...legacy, learningMode: invalid }))).toBeNull();
    }
  });

  it("拒绝把入门战斗或试炼贴上地狱模式标记绕过题库约束", () => {
    const base = createRun("scholar", 42);
    const fight = enterNode(base, availableNodes(base)[0].id);
    fight.learningMode = "hell";
    expect(decodeRun(encodeRun(fight))).toBeNull();
    availableNodes(base)[0].kind = "quiz";
    const quiz = enterNode(base, availableNodes(base)[0].id);
    quiz.learningMode = "hell";
    expect(decodeRun(encodeRun(quiz))).toBeNull();
  });

  it.each([0, 1])("地狱战斗第 %s 步答错沿用原惩罚，读档后能完成练习并继续战斗", step => {
    const base = createRun("weaver", 17, "hell");
    let run = enterNode(base, availableNodes(base)[0].id);
    if (step === 1) run = answerLab(run, caseForBattle(run).correct);
    const c = caseForBattle(run), expected = step === 0 ? c.correct : transferFor(c).correct;
    const hp = run.player.hp, gold = run.player.gold, weak = run.player.weak;
    run = answerLab(run, (expected + 1) % 3);
    expect(run.screen).toBe("combat");
    expect(run.player.hp).toBe(hp);
    expect(run.player.gold).toBe(gold);
    expect(run.player.weak).toBe(weak + (step === 0 ? 1 : 0));
    expect(run.mastery[c.lesson]).toBeUndefined();
    expect(decodeRun(encodeRun(run))).toEqual(run);
    run = decodeRun(encodeRun(run))!;
    if (step === 0) run = answerLab(run, transferFor(caseForBattle(run)).correct);
    expect(combatUnlocked(run)).toBe(true);
    expect(run.player.gold).toBe(gold);
    expect(run.mastery[c.lesson]).toBeUndefined();
    expect(answerLab(run, expected)).toBe(run);
    run.battle!.hand = [{ uid: "continue", defId: "strike", upgraded: false }];
    run.player.energy = 1;
    expect(playCard(run, "continue", run.battle!.enemies[0].id)).not.toBe(run);
    expect(usePotion(run, 0)).not.toBe(run);
    expect(endTurn(run).battle!.turn).toBe(run.battle!.turn + 1);
  });

  it.each([0, 1, 2])("地狱试炼第 %s 题答错仍可继续，按原来的两题正确奖励结算", step => {
    const base = createRun("scholar", 91, "hell");
    const node = availableNodes(base)[0]; node.kind = "quiz";
    let run = enterNode(base, node.id);
    run.quiz!.boss = true;
    for (let i = 0; i < step; i++) run = finishQuiz(answerQuiz(run, trialQuestion(run.quiz!).correct));
    const q = trialQuestion(run.quiz!), gold = run.player.gold;
    run = answerQuiz(run, (q.correct + 1) % 3);
    expect(run.screen).toBe("quiz");
    expect(run.quiz!.correct).toBe(false);
    expect(run.player.gold).toBe(gold);
    expect(answerQuiz(run, q.correct)).toBe(run);
    expect(decodeRun(encodeRun(run))).toEqual(run);
    expect(trialQuestion(run.quiz!)).toEqual(q);
    run = decodeRun(encodeRun(run))!;
    for (let i = step; i < 2; i++) {
      run = finishQuiz(run);
      run = answerQuiz(run, trialQuestion(run.quiz!).correct);
    }
    expect(run.quiz!.trial!.reward).toMatchObject({ gold: 80, heal: 8, potion: "energy", relic: null });
    run = finishQuiz(run);
    expect(run.screen).toBe("map");
    expect(run.act).toBe(2);
    expect(run.player.gold).toBe(gold + 80);
    expect(run.learningMode).toBe("hell");
    expect(finishQuiz(run)).toBe(run);
    expect(decodeRun(encodeRun(run))).toEqual(run);
  });

  it("入门模式答错仍按原流程继续，不受地狱规则影响", () => {
    const base = createRun("scholar", 17);
    let run = enterNode(base, availableNodes(base)[0].id);
    run = answerLab(run, (caseForBattle(run).correct + 1) % 3);
    expect(run.screen).toBe("combat");
    run = answerLab(run, (transferFor(caseForBattle(run)).correct + 1) % 3);
    expect(combatUnlocked(run)).toBe(true);
    availableNodes(base)[0].kind = "quiz";
    run = enterNode(base, availableNodes(base)[0].id);
    run = answerQuiz(run, (trialQuestion(run.quiz!).correct + 1) % 3);
    expect(run.screen).toBe("quiz");
    expect(finishQuiz(run).quiz!.trial!.step).toBe(1);
  });

  it("临时一错即败规则留下的健康存档可继续，惩罚与答案不重置，生命归零仍失败", () => {
    const base = createRun("weaver", 17, "hell");
    let fight = enterNode(base, availableNodes(base)[0].id);
    fight = answerLab(fight, (caseForBattle(fight).correct + 1) % 3);
    fight.screen = "defeat";
    fight.battle!.log.push("地狱挑战结束：工程决策答错。可查看本题解析后重新挑战。");
    const resumed = decodeRun(encodeRun(fight))!;
    expect(resumed.screen).toBe("combat");
    expect(resumed.player).toEqual(fight.player);
    expect(resumed.battle).toEqual(fight.battle);
    expect(decodeRun(encodeRun(resumed))).toEqual(resumed);
    fight.player.hp = 0;
    expect(decodeRun(encodeRun(fight))!.screen).toBe("defeat");

    availableNodes(base)[0].kind = "quiz";
    let quiz = enterNode(base, availableNodes(base)[0].id);
    quiz = answerQuiz(quiz, (trialQuestion(quiz.quiz!).correct + 1) % 3);
    quiz.screen = "defeat";
    const resumedQuiz = decodeRun(encodeRun(quiz))!;
    expect(resumedQuiz.screen).toBe("quiz");
    expect(resumedQuiz.quiz).toEqual(quiz.quiz);
    expect(resumedQuiz.player).toEqual(quiz.player);
    expect(decodeRun(encodeRun(resumedQuiz))).toEqual(resumedQuiz);
    const ordinary = createRun("scholar", 42);
    ordinary.screen = "defeat";
    expect(decodeRun(encodeRun(ordinary))!.screen).toBe("defeat");
  });
});
