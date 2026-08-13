import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ProductService } from './product.service';
import { SupabaseClientService } from '../auth/supabase-client';

function makeSupabaseMock(result: { error: { message: string } | null }) {
  const eq = vi.fn().mockResolvedValue(result);
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { from, update, eq };
}

function setup(result: { error: { message: string } | null }) {
  const supabaseMock = makeSupabaseMock(result);
  TestBed.configureTestingModule({
    providers: [ProductService, { provide: SupabaseClientService, useValue: { client: supabaseMock } }],
  });
  return { service: TestBed.inject(ProductService), supabaseMock };
}

describe('ProductService.publishProduct', () => {
  it('sets the product straight to ACTIVE and clears validation_notes', async () => {
    const { service, supabaseMock } = setup({ error: null });

    await service.publishProduct('prod-1');

    expect(supabaseMock.from).toHaveBeenCalledWith('products');
    expect(supabaseMock.update).toHaveBeenCalledWith({ status: 'ACTIVE', validation_notes: null });
    expect(supabaseMock.eq).toHaveBeenCalledWith('id', 'prod-1');
  });

  it('surfaces the publish-gate rejection (unverified seller) as a thrown error', async () => {
    const { service } = setup({ error: { message: 'SELLER_NOT_VERIFIED' } });

    await expect(service.publishProduct('prod-1')).rejects.toThrow('SELLER_NOT_VERIFIED');
  });
});
