import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  input,
  output,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TableEmptyDirective, TableHeadersDirective, TableRowDirective } from '../../directives';

export { TableEmptyDirective, TableHeadersDirective, TableRowDirective } from '../../directives';
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
                @if (headersTpl) {
                  <ng-container *ngTemplateOutlet="headersTpl.templateRef" />
                }
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              @for (row of rows(); track $index) {
                <tr class="hover:bg-gray-50 transition-colors">
                  @if (rowTpl) {
                    <ng-container *ngTemplateOutlet="rowTpl.templateRef; context: { $implicit: row }" />
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
export class DataTableComponent<T> {
  rows = input.required<T[]>();
  loading = input(false);
  page = input(1);
  totalPages = input(0);
  total = input(0);
  itemLabel = input('elementos');

  pageChange = output<number>();

  @ContentChild(TableHeadersDirective) headersTpl?: TableHeadersDirective;
  @ContentChild(TableRowDirective) rowTpl?: TableRowDirective<T>;
  @ContentChild(TableEmptyDirective) emptyTpl?: TableEmptyDirective;

  protected readonly skeletonRows = [1, 2, 3, 4, 5];
}
