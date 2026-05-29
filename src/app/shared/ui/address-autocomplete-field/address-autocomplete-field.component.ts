import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { AddressSuggestion } from '@shared/domain/address/address-lookup.service.js';

const SUGGESTIONS_CLOSE_DURATION_MS = 180;

@Component({
  selector: 'app-address-autocomplete-field',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './address-autocomplete-field.component.html',
  styleUrl: './address-autocomplete-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressAutocompleteFieldComponent implements OnDestroy {
  @Input({ required: true }) control!: FormControl<string>;
  @Input() readOnly = false;
  @Input() required = false;
  @Input() placeholder = '';
  @Input()
  set showSuggestions(value: boolean) {
    this.showSuggestionsInput = value;
    this.syncSuggestionVisibility();
  }
  get showSuggestions(): boolean {
    return this.showSuggestionsInput;
  }
  @Input() suggestions: readonly AddressSuggestion[] = [];
  @Input() loading = false;
  @Input() listboxLabel = 'Address suggestions';
  @Input() searchStatusLabel = 'Searching addresses...';
  @Input() emptyStatusLabel = 'No matching addresses found.';

  @Output() focused = new EventEmitter<void>();
  @Output() blurred = new EventEmitter<void>();
  @Output() suggestionSelected = new EventEmitter<AddressSuggestion>();
  protected readonly suggestionsVisible = signal(false);
  protected readonly suggestionsClosing = signal(false);
  private showSuggestionsInput = false;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    this.clearCloseTimer();
  }

  protected onSuggestionMouseDown(event: MouseEvent): void {
    event.preventDefault();
  }

  protected onSuggestionClick(suggestion: AddressSuggestion): void {
    this.suggestionSelected.emit(suggestion);
  }

  protected shouldRenderSuggestions(): boolean {
    return this.suggestionsVisible() || this.suggestionsClosing();
  }

  private syncSuggestionVisibility(): void {
    if (this.showSuggestionsInput) {
      this.clearCloseTimer();
      this.suggestionsClosing.set(false);
      this.suggestionsVisible.set(true);
      return;
    }
    this.closeSuggestions();
  }

  private closeSuggestions(): void {
    this.clearCloseTimer();
    if (!this.shouldRenderSuggestions()) {
      return;
    }
    if (this.prefersReducedMotion()) {
      this.suggestionsVisible.set(false);
      this.suggestionsClosing.set(false);
      return;
    }
    this.suggestionsVisible.set(false);
    this.suggestionsClosing.set(true);
    this.closeTimer = setTimeout(() => {
      this.suggestionsClosing.set(false);
      this.closeTimer = null;
    }, SUGGESTIONS_CLOSE_DURATION_MS);
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
