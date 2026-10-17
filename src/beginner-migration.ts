import type { Run } from "./engine";
import { BEGINNER_QUESTIONS } from "./beginner-content";
import { CASES, CASE_BY_ID } from "./learning-cases";
import { trialQuestionAt } from "./trials";

// Called only on a newly parsed and validated run. Keep completed answers under
// their original question definitions; replace only work that is still pending.
export function restoreBeginnerLearning(run: Run): void {
  // An explicit hard-mode choice must survive reload; only legacy/default runs
  // receive the beginner-content migration.
  if (run.learningMode === "hell") return;
  const lab = run.battle?.lab;
  if (lab && lab.transfer === null && CASE_BY_ID[lab.caseId].level !== "beginner") {
    if (lab.choice === null) {
      const lesson = CASE_BY_ID[lab.caseId].lesson;
      const pool = CASES.filter(c => c.level === "beginner" && c.lesson === lesson);
      const replacement = pool[run.seed % pool.length];
      lab.caseId = replacement.id;
      delete lab.beginnerTransfer;
      if (!run.encounteredCases?.includes(replacement.id))
        run.encounteredCases = [...(run.encounteredCases ?? []),replacement.id];
    } else lab.beginnerTransfer = true;
  }
  const quiz = run.quiz;
  if (!quiz) return;
  if (!quiz.trial) {
    if (quiz.selected === null && !quiz.beginnerQuestion) {
      const pool = BEGINNER_QUESTIONS.filter(q => q.lessonId === quiz.lessonId);
      quiz.beginnerQuestion = pool[run.seed % pool.length].id;
    }
    return;
  }
  const t = quiz.trial;
  if (t.revision === 3) return;
  const firstPending = t.step + (quiz.selected === null ? 0 : 1);
  if (firstPending >= 3) return;
  const overrides = t.introOverrides ??= [null,null,null];
  const used = new Set(overrides.filter(Boolean));
  for (let step = firstPending; step < 3; step++) {
    if (overrides[step]) continue;
    const source = trialQuestionAt(quiz,step);
    const related = BEGINNER_QUESTIONS.filter(q => q.chapter === run.act && q.lessonId === source.lessonId && !used.has(q.id));
    const pool = related.length ? related : BEGINNER_QUESTIONS.filter(q => q.chapter === run.act && !used.has(q.id));
    const replacement = pool[(run.seed + step) % pool.length];
    overrides[step] = replacement.id;
    used.add(replacement.id);
  }
  if (quiz.selected === null) quiz.lessonId = trialQuestionAt(quiz,t.step).lessonId;
}
