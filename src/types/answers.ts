export interface AnswerSource {
  title: string;
  url: string;
}

export interface AnswerPayload {
  text: string;
  sources: AnswerSource[];
  summary: string;
  keyPoints: string[];
  legalNotice: string;
}
