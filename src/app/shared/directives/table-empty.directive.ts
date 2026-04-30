import { Directive, TemplateRef } from "@angular/core";

@Directive({ selector: 'ng-template[tableEmpty]', standalone: true })
export class TableEmptyDirective {
    constructor(public templateRef: TemplateRef<void>) { }
}