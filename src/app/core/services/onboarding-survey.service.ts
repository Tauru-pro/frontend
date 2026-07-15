import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import {
  CreateSurveyQuestionDto,
  SurveyInputType,
  SurveyQuestion,
  UpdateSurveyQuestionDto,
} from '../models/onboarding-survey.model';
import { SupabaseClientService } from '../auth/supabase-client';

interface SurveyQuestionRow {
  id: string;
  prompt: string;
  input_type: SurveyInputType;
  options: string[] | null;
  position: number;
  is_required: boolean;
  is_active: boolean;
}

function mapRow(row: SurveyQuestionRow): SurveyQuestion {
  return {
    id: row.id,
    prompt: row.prompt,
    inputType: row.input_type,
    options: row.options ?? [],
    position: row.position,
    isRequired: row.is_required,
    isActive: row.is_active,
  };
}

function toRow(dto: Partial<CreateSurveyQuestionDto>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (dto.prompt !== undefined) row['prompt'] = dto.prompt;
  if (dto.inputType !== undefined) row['input_type'] = dto.inputType;
  if (dto.options !== undefined) row['options'] = dto.options;
  if (dto.position !== undefined) row['position'] = dto.position;
  if (dto.isRequired !== undefined) row['is_required'] = dto.isRequired;
  if (dto.isActive !== undefined) row['is_active'] = dto.isActive;
  return row;
}

@Injectable({ providedIn: 'root' })
export class OnboardingSurveyService {
  private supabase = inject(SupabaseClientService).client;

  /** All questions, ordered — for the super-admin management screen. */
  getAll(): Observable<SurveyQuestion[]> {
    return from(
      this.supabase.from('onboarding_survey_questions').select('*').order('position', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as SurveyQuestionRow[]).map(mapRow);
      })
    );
  }

  /** Active questions only, ordered — what the onboarding wizard renders. */
  getActive(): Observable<SurveyQuestion[]> {
    return from(
      this.supabase
        .from('onboarding_survey_questions')
        .select('*')
        .eq('is_active', true)
        .order('position', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as SurveyQuestionRow[]).map(mapRow);
      })
    );
  }

  getOne(id: string): Observable<SurveyQuestion> {
    return from(
      this.supabase.from('onboarding_survey_questions').select('*').eq('id', id).single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return mapRow(data as SurveyQuestionRow);
      })
    );
  }

  async create(dto: CreateSurveyQuestionDto): Promise<SurveyQuestion> {
    const { data, error } = await this.supabase
      .from('onboarding_survey_questions')
      .insert(toRow(dto))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as SurveyQuestionRow);
  }

  async update(id: string, dto: UpdateSurveyQuestionDto): Promise<SurveyQuestion> {
    const { data, error } = await this.supabase
      .from('onboarding_survey_questions')
      .update(toRow(dto))
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as SurveyQuestionRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from('onboarding_survey_questions').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}
