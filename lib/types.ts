export type ProfileField =
  | "interests"
  | "pace"
  | "availability"
  | "duration"
  | "groupSize"
  | "collaboration"
  | "roles"
  | "communication"
  | "research"
  | "sessionStyle"
  | "resourceStyle"
  | "experienceStyle";

export type PartialProfile = {
  interests?: string[];
  pace?: string;
  availability?: string[];
  duration?: string;
  groupSize?: string;
  collaboration?: string;
  roles?: string[];
  communication?: string;
  research?: string;
  sessionStyle?: string;
  resourceStyle?: string;
  experienceStyle?: string;
};

export type Member = PartialProfile & {
  id: string;
  name: string;
  intro: string;
  qq?: string;
};

export type QuestionOption = {
  value: string;
  label: string;
  hint?: string;
};

export type Question = {
  id: string;
  field: ProfileField;
  prompt: string;
  context: string;
  multi?: boolean;
  maxSelections?: number;
  options: QuestionOption[];
};

export type MatchResult = {
  member: Member;
  score: number;
  confidence: number;
  reasons: string[];
  eligible: boolean;
};
