import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SellerDocumentService } from './seller-document.service';
import { SupabaseClientService } from '../auth/supabase-client';

function makeSupabaseMock(countResult: { count: number | null; error: { message: string } | null }) {
  const invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
  const eq = vi.fn().mockResolvedValue(countResult);
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { functions: { invoke }, from, select, eq };
}

function setup(countResult: { count: number | null; error: { message: string } | null } = { count: 0, error: null }) {
  const supabaseMock = makeSupabaseMock(countResult);
  TestBed.configureTestingModule({
    providers: [
      SellerDocumentService,
      { provide: SupabaseClientService, useValue: { client: supabaseMock } },
    ],
  });
  return { service: TestBed.inject(SellerDocumentService), supabaseMock };
}

describe('SellerDocumentService review actions', () => {
  it('approveDocument invokes seller-document-validate with an APPROVED decision', async () => {
    const { service, supabaseMock } = setup();

    await service.approveDocument('doc-1');

    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('seller-document-validate', {
      body: { documentId: 'doc-1', decision: 'APPROVED', reason: undefined },
    });
  });

  it('rejectDocument invokes seller-document-validate with a REJECTED decision and reason', async () => {
    const { service, supabaseMock } = setup();

    await service.rejectDocument('doc-1', 'Documento ilegible');

    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('seller-document-validate', {
      body: { documentId: 'doc-1', decision: 'REJECTED', reason: 'Documento ilegible' },
    });
  });

  it('getPendingReviewCount returns the PENDING_REVIEW count for the sidebar badge', async () => {
    const { service, supabaseMock } = setup({ count: 4, error: null });

    const count = await service.getPendingReviewCount();

    expect(count).toBe(4);
    expect(supabaseMock.from).toHaveBeenCalledWith('seller_documents');
    expect(supabaseMock.eq).toHaveBeenCalledWith('status', 'PENDING_REVIEW');
  });

  it('getPendingReviewCount falls back to 0 when count is null', async () => {
    const { service } = setup({ count: null, error: null });

    const count = await service.getPendingReviewCount();

    expect(count).toBe(0);
  });
});
