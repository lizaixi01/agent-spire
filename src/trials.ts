import { ENGINEERING_TRIALS } from "./trial-bank";
import { LEGACY_TRIALS } from "./trial-bank-v1";
import { LESSON_BY_ID } from "./content";
import type { Run, LearningMode } from "./engine";
import { rewardRelics, type RelicId } from "./cards";
import { BEGINNER_TRIALS, BEGINNER_BY_ID, practiceQuestion } from "./beginner-content";
import { HELL_QUESTIONS, HELL_TRIALS } from "./hell-content";

export interface TrialQuestion {
  id?: string;
  kind?: "trace" | "debug" | "tradeoff";
  codeLanguage?: "python";
  optionReasons?: string[];
  lessonId: string;
  chapter: number;
  section: string;
  page: number;
  title: string;
  question: string;
  code: string;
  options: string[];
  correct: number;
  explanation: string;
  level?: "beginner";
  intro?: string;
  scene?: string;
  hint?: string;
}
export interface EngineeringQuestion extends TrialQuestion {
  id: string;
  kind: "trace" | "debug" | "tradeoff";
  codeLanguage: "python";
  optionReasons: [string,string,string];
}
export interface TrialReward {
  gold: number;
  heal: number;
  relic: RelicId | null;
  potion: "energy" | null;
}
export interface Trial {
  id: string;
  topic: "checkpoint" | "memory" | "compaction" | "engineering" | "beginner";
  title: string;
  questions: TrialQuestion[];
}
export const TRIALS: Trial[] = BEGINNER_TRIALS;
export function trialsForMode(mode: LearningMode = "beginner"): Trial[] {
  return mode === "hell" ? HELL_TRIALS : BEGINNER_TRIALS;
}
export function practiceForMode(lessonId: string, mode: LearningMode = "beginner"): TrialQuestion {
  if (mode === "hell") {
    const question = HELL_QUESTIONS.find(q => q.lessonId === lessonId);
    if (!question) throw new Error(`Missing hell practice: ${lessonId}`);
    return question;
  }
  return practiceQuestion(lessonId);
}
export const TRIAL_BY_ID = Object.fromEntries([...ENGINEERING_TRIALS,...BEGINNER_TRIALS,...HELL_TRIALS].map(t => [t.id, t])) as Record<string, Trial>;
const HELL_BY_ID = Object.fromEntries(HELL_TRIALS.map(t => [t.id,t])) as Record<string,Trial>;
const ENGINEERING_BY_ID = Object.fromEntries(ENGINEERING_TRIALS.map(t => [t.id,t])) as Record<string,Trial>;
const BEGINNER_TRIAL_BY_ID = Object.fromEntries(BEGINNER_TRIALS.map(t => [t.id,t])) as Record<string,Trial>;
const LEGACY_BY_ID = Object.fromEntries(LEGACY_TRIALS.map(t => [t.id,t])) as Record<string,Trial>;
export function trialDefinition(quiz: NonNullable<Run["quiz"]>): Trial {
  const t=quiz.trial!;
  return (t.revision === 4 ? HELL_BY_ID : t.revision === 3 ? BEGINNER_TRIAL_BY_ID : t.revision === 2 ? ENGINEERING_BY_ID : LEGACY_BY_ID)[t.id];
}
export function trialQuestionAt(quiz: NonNullable<Run["quiz"]>, step: number): TrialQuestion {
  const t = quiz.trial!;
  const override = t.introOverrides?.[step];
  const original = override ? BEGINNER_BY_ID[override] : trialDefinition(quiz).questions[t.order?.[step] ?? step];
  const order = t.optionOrders?.[step] ?? [0,1,2];
  return {...original, options: order.map(i=>original.options[i]), correct: order.indexOf(original.correct),
    optionReasons: original.optionReasons ? order.map(i=>original.optionReasons![i]) : undefined};
}
export function trialQuestion(quiz: NonNullable<Run["quiz"]>): TrialQuestion {
  if (quiz.trial) return trialQuestionAt(quiz,quiz.trial.step);
  if (quiz.beginnerQuestion) return BEGINNER_BY_ID[quiz.beginnerQuestion];
  const l = LESSON_BY_ID[quiz.lessonId];
  return { ...l, lessonId: l.id, code: "" };
}
export function trialScore(quiz: NonNullable<Run["quiz"]>): number {
  return quiz.trial ? quiz.trial.answers.filter((a, i) => a === trialQuestionAt(quiz,i).correct).length : Number(quiz.correct);
}
export function trialReward(run: Run): TrialReward {
  const score = trialScore(run.quiz!);
  if (score < 2) return { gold: 0, heal: 0, relic: null, potion: null };
  if (score === 2) return { gold: run.player.potions.length < 3 ? 80 : 110, heal: 8, relic: null, potion: run.player.potions.length < 3 ? "energy" : null };
  const relic = rewardRelics(run.player.relics)[0] ?? null;
  return { gold: relic ? 140 : 200, heal: 12, relic, potion: null };
}
