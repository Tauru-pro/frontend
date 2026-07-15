import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { TermsAudience, TermsDocument } from '../models/terms.model';
import { SupabaseClientService } from '../auth/supabase-client';

interface TermsDocumentRow {
  id: string;
  audience: TermsAudience;
  version: string;
  content: string;
}

@Injectable({ providedIn: 'root' })
export class TermsService {
  private supabase = inject(SupabaseClientService).client;

  /** The current terms document for an audience (readable without a session). */
  getCurrent(audience: TermsAudience): Observable<TermsDocument> {
    return from(
      this.supabase
        .from('terms_documents')
        .select('id, audience, version, content')
        .eq('audience', audience)
        .eq('is_current', true)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as TermsDocumentRow;
      })
    );
  }
}
