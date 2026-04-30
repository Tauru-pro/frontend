import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

type ButtonVariant = 'primary' | 'primary-outline' | 'accent' | 'secondary';
type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonType = 'button' | 'submit' | 'reset';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  'primary': 'btn-primary',
  'primary-outline': 'btn-primary-outline',
  'accent': 'btn-accent',
  'secondary': 'btn-secondary',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

@Component({
  selector: 'app-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [disabled]="disabled()"
      [class]="computedClass()"
      (click)="clicked.emit()"
    >
      @if (iconPath()) {
        <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="iconPath()"/>
        </svg>
      }
      <ng-content />
    </button>
  `,
})
export class ButtonComponent {
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  type = input<ButtonType>('button');
  disabled = input(false);
  iconPath = input<string | undefined>(undefined);

  clicked = output<void>();

  protected computedClass = computed(() => {
    const base = 'flex items-center gap-2';
    return `${base} ${VARIANT_CLASS[this.variant()]} ${SIZE_CLASS[this.size()]}`;
  });
}
