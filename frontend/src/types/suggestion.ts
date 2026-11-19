export type SuggestionSearchType = "poll" | "question" | "answer_option";

export interface Suggestion {
  id: number;
  name: string;
  question_name?: string;
}
