import { Directive, Input, TemplateRef } from '@angular/core';

@Directive({ selector: 'ng-template[tableCell]', standalone: true })
export class TableCellDirective<T> {
  @Input('tableCell') columnKey!: string;

  constructor(public templateRef: TemplateRef<{ $implicit: T }>) {}

  static ngTemplateContextGuard<T>(
    _dir: TableCellDirective<T>,
    ctx: unknown,
  ): ctx is { $implicit: T } {
    return true;
  }
}
