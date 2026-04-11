import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { AddressSuggestion } from '@shared/domain/address/address-lookup.service.js';

@Component({
  selector: 'app-address-autocomplete-field',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './address-autocomplete-field.component.html',
  styleUrl: './address-autocomplete-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressAutocompleteFieldComponent {
  @Input({ required: true }) control!: FormControl<string>;
  @Input() readOnly = false;
  @Input() required = false;
  @Input() placeholder = '';
  @Input() showSuggestions = false;
  @Input() suggestions: readonly AddressSuggestion[] = [];
  @Input() loading = false;
  @Input() listboxLabel = 'Address suggestions';
  @Input() searchStatusLabel = 'Searching addresses...';
  @Input() emptyStatusLabel = 'No matching addresses found.';

  @Output() focused = new EventEmitter<void>();
  @Output() blurred = new EventEmitter<void>();
  @Output() suggestionSelected = new EventEmitter<AddressSuggestion>();

  protected onSuggestionMouseDown(event: MouseEvent): void {
    event.preventDefault();
  }

  protected onSuggestionClick(suggestion: AddressSuggestion): void {
    this.suggestionSelected.emit(suggestion);
  }
}

