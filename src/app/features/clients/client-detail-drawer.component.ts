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
import { RouterLink } from '@angular/router';
import type {
  ClientDetail,
  ClientHistoryEntry,
  ClientSummary,
  UpdateClientPayload,
} from '@shared/domain/entry/entry-repository.service.js';
import type { SalesStatus } from '@shared/domain/entry/entry-modal.models.js';
import type { ClientDetailState } from './clients.types.js';

@Component({
  standalone: true,
  selector: 'app-client-detail-drawer',
  templateUrl: './client-detail-drawer.component.html',
  styleUrls: ['./client-detail-drawer.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDetailDrawerComponent {
  @Input({ required: true }) client!: ClientSummary;
  @Input() detail: ClientDetail | null = null;
  @Input() state: ClientDetailState = 'loading';
  @Input() updatingSalesStatusEntryId: string | null = null;
  @Input() salesStatusError: string | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();
  @Output() updateClient = new EventEmitter<UpdateClientPayload>();
  @Output() deleteClient = new EventEmitter<void>();
  @Output() editEntry = new EventEmitter<ClientHistoryEntry>();
  @Output() deleteEntry = new EventEmitter<ClientHistoryEntry>();
  @Output() duplicateEntry = new EventEmitter<ClientHistoryEntry>();
  @Output() changeSalesStatus = new EventEmitter<{
    history: ClientHistoryEntry;
    salesStatus: SalesStatus;
  }>();

  private readonly fb = inject(NonNullableFormBuilder);
  readonly clientForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    address: ['', Validators.required],
    phone: ['', Validators.required],
    email: [''],
  });
  protected editingClient = false;

  protected get drawerHeadingId(): string {
    return `client-drawer-${encodeURIComponent(this.client.clientId)}`;
  }

  trackHistory(_: number, history: ClientHistoryEntry): string {
    return history.entryId;
  }

  protected formatCurrency(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '--';
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

  protected requestEntryDuplicate(history: ClientHistoryEntry): void {
    this.duplicateEntry.emit(history);
  }

  protected requestSalesStatusChange(history: ClientHistoryEntry, salesStatus: SalesStatus): void {
    this.changeSalesStatus.emit({ history, salesStatus });
  }

  protected formatExecutionStatus(
    status: 'scheduled' | 'running' | 'completed' | undefined,
  ): string {
    if (status === 'completed') {
      return 'Completed';
    }
    if (status === 'running') {
      return 'In progress';
    }
    if (status === 'scheduled') {
      return 'Scheduled';
    }
    return 'Unknown';
  }

  protected formatHours(value: number): string {
    return Number.isInteger(value) ? `${value}h` : `${value.toFixed(2)}h`;
  }

  protected getSalesStatus(history: ClientHistoryEntry): SalesStatus {
    return history.salesStatus ?? (history.variant === 'customer' ? 'accepted' : 'open');
  }

  protected formatSalesStatus(status: SalesStatus): string {
    switch (status) {
      case 'accepted':
        return 'Accepted';
      case 'not-proceeding':
        return 'Not proceeding';
      default:
        return 'Open';
    }
  }

  protected getSalesStatusLabel(history: ClientHistoryEntry): string {
    const status = this.getSalesStatus(history);
    return status === 'accepted' && !history.calendar && history.execution?.status !== 'completed'
      ? 'Accepted · To schedule'
      : this.formatSalesStatus(status);
  }

  protected canReopen(history: ClientHistoryEntry): boolean {
    if (history.execution?.status === 'completed') return false;
    if (!history.calendar?.start) return true;
    const start = new Date(history.calendar.start).getTime();
    return Number.isFinite(start) && start > Date.now();
  }

  protected isPastScheduled(history: ClientHistoryEntry): boolean {
    if (!history.calendar?.start) return false;
    const start = new Date(history.calendar.start).getTime();
    return Number.isFinite(start) && start <= Date.now();
  }

  protected getRelationshipLabel(): string {
    switch (this.client.relationshipStatus) {
      case 'customer':
        return 'Customer';
      case 'inactive':
        return 'Inactive';
      default:
        return 'Lead';
    }
  }
}
