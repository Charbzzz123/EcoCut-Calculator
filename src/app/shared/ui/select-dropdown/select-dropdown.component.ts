import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  ViewChild,
  signal,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';

const NOOP = (): void => {
  return;
};
const MENU_CLOSE_DURATION_MS = 180;

export interface SelectDropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

@Component({
  standalone: true,
  selector: 'app-select-dropdown',
  templateUrl: './select-dropdown.component.html',
  styleUrl: './select-dropdown.component.scss',
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: SelectDropdownComponent,
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectDropdownComponent implements ControlValueAccessor, OnDestroy {
  @Input() options: readonly SelectDropdownOption[] = [];
  @Input() placeholder = 'Select';
  @Input() emptyLabel = 'No options available';
  @Input() ariaLabel = 'Dropdown';
  @Input() panelMaxHeight = '14rem';
  @ViewChild('dropdownRoot') private dropdownRoot?: ElementRef<HTMLElement>;

  protected readonly menuOpen = signal(false);
  protected readonly menuClosing = signal(false);
  protected readonly controlValue = signal('');
  private readonly isDisabled = signal(false);
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private onChange: (value: string) => void = NOOP;
  private onTouched: () => void = NOOP;

  ngOnDestroy(): void {
    this.clearCloseTimer();
  }

  protected hasOptions(): boolean {
    return this.options.length > 0;
  }

  protected isTriggerDisabled(): boolean {
    return this.isDisabled() || this.options.length === 0;
  }

  protected shouldRenderMenu(): boolean {
    return this.menuOpen() || this.menuClosing();
  }

  protected selectedLabel(): string {
    if (this.options.length === 0) {
      return this.emptyLabel;
    }
    const current = this.options.find((option) => option.value === this.controlValue());
    if (current) {
      return current.label;
    }
    const firstAvailable =
      this.options.find((option) => !option.disabled) ?? this.options[0];
    return firstAvailable?.label ?? this.placeholder;
  }

  writeValue(value: string | null): void {
    this.controlValue.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
    if (isDisabled) {
      this.closeMenu(false);
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen()) {
      return;
    }
    const root = this.dropdownRoot?.nativeElement;
    const target = event.target;
    if (!root || !(target instanceof Node) || !root.contains(target)) {
      this.closeMenu();
      this.onTouched();
    }
  }

  protected toggleMenu(): void {
    if (this.isTriggerDisabled()) {
      this.closeMenu(false);
      return;
    }
    if (this.menuOpen()) {
      this.closeMenu();
      return;
    }
    this.openMenu();
  }

  protected selectOption(option: SelectDropdownOption): void {
    if (option.disabled) {
      return;
    }
    this.controlValue.set(option.value);
    this.onChange(option.value);
    this.closeMenu();
    this.onTouched();
  }

  protected isActive(option: SelectDropdownOption): boolean {
    return option.value === this.controlValue();
  }

  private openMenu(): void {
    this.clearCloseTimer();
    this.menuClosing.set(false);
    this.menuOpen.set(true);
  }

  private closeMenu(withMotion = true): void {
    this.clearCloseTimer();
    if (!this.shouldRenderMenu()) {
      return;
    }
    if (!withMotion || this.prefersReducedMotion()) {
      this.menuOpen.set(false);
      this.menuClosing.set(false);
      return;
    }
    this.menuOpen.set(false);
    this.menuClosing.set(true);
    this.closeTimer = setTimeout(() => {
      this.menuClosing.set(false);
      this.closeTimer = null;
    }, MENU_CLOSE_DURATION_MS);
  }

  private clearCloseTimer(): void {
    if (!this.closeTimer) {
      return;
    }
    clearTimeout(this.closeTimer);
    this.closeTimer = null;
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
