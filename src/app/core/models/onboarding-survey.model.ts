export type SurveyInputType = 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'TEXT' | 'NUMBER';

export interface SurveyQuestion {
  id: string;
  prompt: string;
  inputType: SurveyInputType;
  options: string[];
  position: number;
  isRequired: boolean;
  isActive: boolean;
}

export interface CreateSurveyQuestionDto {
  prompt: string;
  inputType: SurveyInputType;
  options: string[];
  position: number;
  isRequired: boolean;
  isActive: boolean;
}

export type UpdateSurveyQuestionDto = Partial<CreateSurveyQuestionDto>;

/** A user's answer to one survey question, ready to send to the onboarding function. */
export interface SurveyAnswer {
  question_id: string;
  answer: string | string[] | number | null;
}
