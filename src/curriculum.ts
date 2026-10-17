import { actLessons, CHAPTER_COUNT, LESSON_BY_ID } from "./content";
import type { Run } from "./engine";
import { CASE_BY_ID } from "./learning-cases";

export function restoreCurriculum(run: Run): void {
  if (run.curriculumVersion === 2) return;
  const position = run.map.find(n => n.id === run.position);
  const upcoming = run.screen === "map" ? run.map.find(n => position?.next.includes(n.id)) : undefined;
  const labLesson = run.screen === "combat" && run.battle?.lab ? CASE_BY_ID[run.battle.lab.caseId].lesson : undefined;
  const quizLesson = run.screen === "quiz" ? run.quiz?.lessonId : undefined;
  const lessonId = quizLesson ?? labLesson ?? upcoming?.lessonId ?? position?.lessonId ?? run.map[0].lessonId;
  run.act = run.screen === "victory" ? CHAPTER_COUNT : LESSON_BY_ID[lessonId].chapter;
  const lessons = actLessons(run.act);
  for (const node of run.map) if (LESSON_BY_ID[node.lessonId].chapter !== run.act)
    node.lessonId = lessons[(node.row * 3 + node.col) % lessons.length].id;
  run.curriculumVersion = 2;
}
