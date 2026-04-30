import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  ContentChildren,
  input,
  output,
  QueryList,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TableEmptyDirective } from '../../directives/table-empty.directive';
import { TableCellDirective } from '../../directives/table-cell.directive';
import { TableColumn } from '../../interfaces/table-column.interface';

export { TableEmptyDirective } from '../../directives/table-empty.directive';
export { TableCellDirective } from '../../directives/table-cell.directive';
export type { TableColumn } from '../../interfaces/table-column.interface';

const TH_BASE = 'text-left text-xs font-semibold text-gray-400 uppercase tracking-wider';
const TD_BASE = 'px-4 py-4';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden">

      @if (loading()) {
        <div class="p-6 space-y-3">
          @for (_ of skeletonRows; track $index) {
            <div class="h-10 bg-gray-100 rounded-xl animate-pulse"></div>
          }
        </div>
      } @else if (rows().length === 0) {
        @if (emptyTpl) {
          <ng-container *ngTemplateOutlet="emptyTpl.templateRef" />
        } @else {
          <div class="py-16 flex flex-col items-center text-center px-6">
            <div class="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <svg class="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <p class="text-gray-800 font-semibold mb-1">Sin resultados</p>
            <p class="text-gray-400 text-sm">No hay elementos para mostrar.</p>
          </div>
        }
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100">
                @for (col of columns(); track col.key) {
                  <th [class]="thClass(col)">{{ col.label }}</th>
                }
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              @for (row of rows(); track $index) {
                <tr class="hover:bg-gray-50 transition-colors">
                  @for (col of columns(); track col.key) {
                    <td [class]="tdClass(col)">
                      @if (cellTplMap.get(col.key); as tpl) {
                        <ng-container *ngTemplateOutlet="tpl; context: { $implicit: row }" />
                      } @else {
                        {{ asRecord(row)[col.key] }}
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (totalPages() > 1) {
          <div class="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p class="text-sm text-gray-500">
              Página <span class="font-medium text-gray-800">{{ page() }}</span> de
              <span class="font-medium text-gray-800">{{ totalPages() }}</span>
              &nbsp;·&nbsp; {{ total() }} {{ itemLabel() }}
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                (click)="pageChange.emit(page() - 1)"
                [disabled]="page() === 1"
                class="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <button
                type="button"
                (click)="pageChange.emit(page() + 1)"
                [disabled]="page() === totalPages()"
                class="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        }
      }

    </div>
  `,
})
export class DataTableComponent<T> implements AfterContentInit {
  rows = input.required<T[]>();
  columns = input.required<TableColumn<T>[]>();
  loading = input(false);
  page = input(1);
  totalPages = input(0);
  total = input(0);
  itemLabel = input('elementos');

  pageChange = output<number>();

  @ContentChild(TableEmptyDirective) emptyTpl?: TableEmptyDirective;
  @ContentChildren(TableCellDirective) private cellTpls!: QueryList<TableCellDirective<T>>;

  protected cellTplMap = new Map<string, TemplateRef<{ $implicit: T }>>();
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  ngAfterContentInit(): void {
    this.cellTplMap = new Map(
      this.cellTpls.map(d => [d.columnKey, d.templateRef]),
    );
  }

  protected thClass(col: TableColumn<T>): string {
    return `${TH_BASE} ${col.headerClass ?? 'px-4 py-3'}`;
  }

  protected tdClass(col: TableColumn<T>): string {
    return col.cellClass ? `${TD_BASE} ${col.cellClass}` : TD_BASE;
  }

  protected asRecord(row: T): Record<string, unknown> {
    return row as Record<string, unknown>;
  }
}
