import { Directive, TemplateRef } from "@angular/core";

@Directive({ selector: 'ng-template[tableRow]', standalone: true })
export class TableRowDirective<T> {
    constructor(public templateRef: TemplateRef<{ $implicit: T }>) { }

    static ngTemplateContextGuard<T>(
        _dir: TableRowDirective<T>,
        ctx: unknown,
    ): ctx is { $implicit: T } {
        return true;
    }
}