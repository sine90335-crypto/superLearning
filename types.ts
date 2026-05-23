
export interface Flashcard {
  id: string;
  sourceNoteId: string;
  front: string;
  back: string;
  tags: string[];
  level: number;
  nextReview: number;
  lastInterval: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface UserStats {
  xp: number;
  level: number;
  streak: number;
  completedCards: number;
  lastActive: string;
  totalFocusTimeMinutes: number;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  EDITOR = 'EDITOR',
  REVIEW = 'REVIEW',
  GRAPH = 'GRAPH',
  DEMO = 'DEMO',
  QUIZ = 'QUIZ',
  REWARD = 'REWARD',
  LIBRARY = 'LIBRARY',
  PLANS = 'PLANS',
  LLM_WIKI = 'LLM_WIKI'
}

export interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  type?: 'pdf' | 'note';
}

export interface DemoStep {
  title: string;
  description: string;
  visualHighlight?: string;
}

export interface PlanTask {
  id: string;
  time?: string;
  task: string;
  done: boolean;
  units?: number;
  remainingSeconds?: number;
  isActive?: boolean;
  googleTaskId?: string;
  googleTaskListId?: string;
}

export interface LearningPlan {
  id: string;
  goal: string;
  macro: {
    month: string;
    milestones: string[];
  }[];
  daily: PlanTask[];
}

export interface DailyStudyLog {
  date: string;
  minutes: number;
  unitsCompleted: number;
}
