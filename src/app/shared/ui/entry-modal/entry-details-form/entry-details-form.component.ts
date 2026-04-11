import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  Signal,
  ViewChild,
} from '@angular/core';
import {
  ControlContainer,
  FormControl,
  FormGroup,
  FormGroupDirective,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  EntryVariant,
  HedgeId,
  HedgeState,
  RabattageOption,
  TrimPreset,
} from '@shared/domain/entry/entry-modal.models.js';
import type { AddressSuggestion } from '@shared/domain/address/address-lookup.service.js';
import { PanelState } from '../entry-modal-panel.store.js';
import { AddressAutocompleteFieldComponent } from '@shared/ui/address-autocomplete-field/address-autocomplete-field.component.js';

export interface EntryDetailsFormHandlers {
  handlePhoneInput(event: Event): void;
  selectAddressSuggestion(suggestion: AddressSuggestion): void;
  handleAddressFocus(): void;
  handleAddressBlur(): void;
  cycleHedge(event: MouseEvent, hedgeId: HedgeId): void;
  updateTrimSection(section: 'inside' | 'top' | 'outside', checked: boolean): void;
  selectTrimPreset(preset: TrimPreset): void;
  selectRabattage(option: RabattageOption): void;
  updatePartialAmount(value: string): void;
  savePanel(): void;
  cancelPanel(): void;
  beginPanelDrag(event: PointerEvent): void;
}

@Component({
  selector: 'app-entry-details-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AddressAutocompleteFieldComponent],
  templateUrl: './entry-details-form.component.html',
  styleUrl: './entry-details-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
})
export class EntryDetailsFormComponent implements OnDestroy {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) variant: EntryVariant = 'warm-lead';
  @Input() hedgeSelectionError: string | null = null;
  @Input({ required: true }) hedges: readonly HedgeId[] = [];
  @Input({ required: true }) hedgePoints!: Record<HedgeId, string>;
  @Input({ required: true }) panelState!: Signal<PanelState | null>;
  @Input({ required: true }) panelPosition!: Signal<{ left: number; top: number }>;
  @Input({ required: true }) panelError!: Signal<string | null>;
  @Input({ required: true }) panelFloats!: () => boolean;
  @Input({ required: true }) trimHasCustomSelections!: () => boolean;
  @Input({ required: true }) trimPresetSelected!: () => TrimPreset | null;
  @Input({ required: true }) hasSavedConfig!: (hedgeId: HedgeId) => boolean;
  @Input({ required: true }) getHedgeState!: (hedgeId: HedgeId) => HedgeState;
  @Input({ required: true }) handlers!: EntryDetailsFormHandlers;
  @Input() addressSuggestions: readonly AddressSuggestion[] = [];
  @Input() showAddressSuggestions = false;
  @Input() addressLookupLoading = false;
  @Input() addressLookupMessage: string | null = null;
  @Input() addressVerified = false;
  @Output() canvasHostChange = new EventEmitter<ElementRef<HTMLElement> | undefined>();

  @ViewChild('canvasHost', { static: false })
  set canvasHost(ref: ElementRef<HTMLElement> | undefined) {
    this.canvasHostRef = ref;
    queueMicrotask(() => this.canvasHostChange.emit(ref));
  }

  private canvasHostRef?: ElementRef<HTMLElement>;

  readonly jobTypeOptions = ['Hedge Trimming', 'Rabattage', 'Both'] as const;
  readonly rabattageOptions: RabattageOption[] = ['partial', 'total', 'total_no_roots'];

  protected get addressControl(): FormControl<string> {
    return this.form.controls['address'] as FormControl<string>;
  }

  protected jobTypeSelected(): boolean {
    const control = this.form?.get('jobType');
    return !!control?.value;
  }

  protected controlInvalid(path: string): boolean {
    const control = this.form?.get(path);
    return !!control && control.touched && control.invalid;
  }

  protected phoneHasError(type: 'required' | 'phoneInvalid'): boolean {
    const control = this.form?.get('phone');
    return !!control && control.touched && !!control.errors?.[type];
  }

  ngOnDestroy(): void {
    if (this.canvasHostRef) {
      queueMicrotask(() => this.canvasHostChange.emit(undefined));
    }
  }
}
