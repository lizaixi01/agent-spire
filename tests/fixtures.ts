import { createRun, finishQuiz, type Run } from "../src/engine";
import { caseForBattle } from "../src/learning-cases";
import { actLessons } from "../src/content";
import type { CharacterId } from "../src/cards";

export function chapterRun(character: CharacterId, seed: number, chapter = 1): Run {
  let run = createRun(character, seed);
  while (run.act < chapter) run = finishQuiz({ ...run, screen: "quiz", quiz: {
    lessonId: actLessons(run.act)[0].id, selected: 0, correct: false, boss: true,
  } });
  return run;
}

// Isolate card arithmetic from the separate learning-reward workflow.
export function readyForCards(run: Run): Run {
  run.battle!.lab = { caseId: caseForBattle(run).id, choice: 0, transfer: 0 };
  return run;
}
