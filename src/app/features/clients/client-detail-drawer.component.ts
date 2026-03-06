import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type {
  ClientDetail,
  ClientHistoryEntry,
  ClientSummary,
  UpdateClientPayload,
} from '@shared/domain/entry/entry-repository.service.js';
import type { ClientDetailState } from './clients.types.js';

@Component({
  standalone: true,
  selector: 'app-client-detail-drawer',
  templateUrl: './client-detail-drawer.component.html',
  styleUrls: ['./client-detail-drawer.component.scss'],
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDetailDrawerComponent {
  @Input({ required: true }) client!: ClientSummary;
  @Input() detail: ClientDetail | null = null;
  @Input() state: ClientDetailState = 'loading';
  @Output() closed = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();
  @Output() updateClient = new EventEmitter<UpdateClientPayload>();
  @Output() deleteClient = new EventEmitter<void>();
  @Output() editEntry = new EventEmitter<ClientHistoryEntry>();
  @Output() deleteEntry = new EventEmitter<ClientHistoryEntry>();

  private readonly fb = inject(NonNullableFormBuilder);
  readonly clientForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    address: ['', Validators.required],
    phone: ['', Validators.required],
    email: [''],
  });
  protected editingClient = false;

  trackHistory(_: number, history: ClientHistoryEntry): string {
    return history.entryId;
  }

  protected formatCurrency(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `$${value.toLocaleString('en-US')}`;
    }
    const numeric = Number(value.toString().replace(/[^0-9.-]/g, ''));
    return Number.isFinite(numeric) && value !== ''
      ? `$${numeric.toLocaleString('en-US')}`
      : value.toString();
  }

  protected startClientEdit(): void {
    this.editingClient = true;
    this.clientForm.setValue({
      firstName: this.client.firstName,
      lastName: this.client.lastName,
      address: this.client.address,
      phone: this.client.phone,
      email: this.client.email ?? '',
    });
  }

  protected cancelClientEdit(): void {
    this.editingClient = false;
    this.clientForm.reset();
  }

  protected submitClientEdits(): void {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return;
    }
    const formValue = this.clientForm.getRawValue();
    const updates: UpdateClientPayload = {};
    if (formValue.firstName !== this.client.firstName) {
      updates.firstName = formValue.firstName;
    }
    if (formValue.lastName !== this.client.lastName) {
      updates.lastName = formValue.lastName;
    }
    if (formValue.address !== this.client.address) {
      updates.address = formValue.address;
    }
    if (formValue.phone !== this.client.phone) {
      updates.phone = formValue.phone;
    }
    const normalizedEmail = (formValue.email ?? '').trim();
    if (normalizedEmail !== (this.client.email ?? '')) {
      updates.email = normalizedEmail;
    }
    this.editingClient = false;
    this.clientForm.reset();
    if (!Object.keys(updates).length) {
      return;
    }
    this.updateClient.emit(updates);
  }

  protected requestClientDelete(): void {
    this.deleteClient.emit();
  }

  protected requestEntryEdit(history: ClientHistoryEntry): void {
    this.editEntry.emit(history);
  }

  protected requestEntryDelete(history: ClientHistoryEntry): void {
    this.deleteEntry.emit(history);
  }
}
