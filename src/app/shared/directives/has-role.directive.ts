import { Directive, effect, inject, Input, signal, TemplateRef, ViewContainerRef } from '@angular/core';
import { UserStore } from '../../core/store/user.store';

/**
 * Structural directive that shows an element only when the current user has one of the allowed roles.
 *
 * Usage:
 *   *hasRole="'ADMIN'"
 *   *hasRole="['ADMIN', 'SELLER']"
 */
@Directive({
  selector: '[hasRole]',
  standalone: true,
})
export class HasRoleDirective {
  private userStore  = inject(UserStore);
  private templateRef = inject(TemplateRef<unknown>);
  private vcr        = inject(ViewContainerRef);

  private readonly roles = signal<string[]>([]);

  @Input() set hasRole(value: string | string[]) {
    this.roles.set(Array.isArray(value) ? value : [value]);
  }

  constructor() {
    effect(() => {
      const userRole = this.userStore.user()?.role ?? '';
      this.vcr.clear();
      if (this.roles().includes(userRole)) {
        this.vcr.createEmbeddedView(this.templateRef);
      }
    });
  }
}
