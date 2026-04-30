import { Directive, TemplateRef } from "@angular/core";

@Directive({ selector: 'ng-template[tableHeaders]', standalone: true })
export class TableHeadersDirective {
    constructor(public templateRef: TemplateRef<void>) { }
}