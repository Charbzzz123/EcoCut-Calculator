import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs';
import {
  ClientDetail,
  ClientHistoryEntry,
  ClientSummary,
  EntryRepositoryService,
  UpdateClientPayload,
} from '@shared/domain/entry/entry-repository.service.js';
import type { EntryModalPayload, EntryVariant } from '@shared/domain/entry/entry-modal.models.js';
import type { ClientDetailState, ClientsLoadState } from './clients.types.js';

const digitsOnly = (value: string): string => value.replace(/\D/g, '');

@Injectable({ providedIn: 'root' })
export class ClientsFacade {
  private readonly repository = inject(EntryRepositoryService);

  readonly headingId = 'client-roster-heading';
  readonly queryControl = new FormControl('', { nonNullable: true });

  private readonly querySignal = signal('');
  private readonly clientsSignal: WritableSignal<ClientSummary[]> = signal<ClientSummary[]>([]);
  private readonly loadStateSignal: WritableSignal<ClientsLoadState> = signal<ClientsLoadState>('loading');
  private readonly activeClientSignal = signal<ClientSummary | null>(null);
  private readonly detailSignal = signal<ClientDetail | null>(null);
  private readonly detailStateSignal = signal<ClientDetailState>('loading');
  private readonly entryEditorOpenSignal = signal(false);
  private readonly entryEditorPayloadSignal = signal<EntryModalPayload | null>(null);
  private readonly entryEditorVariantSignal = signal<EntryVariant>('warm-lead');
  private readonly entryEditorHeadlineSignal = signal('Edit job');
  private readonly entryEditorEyebrowSignal = signal('Client job');
  private detailRequestId = 0;
  private editingEntryId: string | null = null;

  readonly loadState: Signal<ClientsLoadState> = this.loadStateSignal.asReadonly();
  readonly filteredClients = computed(() => this.filterClients(this.clientsSignal(), this.querySignal()));
  readonly stats = computed(() => this.computeStats(this.clientsSignal()));
  readonly drawerVisible = computed(() => this.activeClientSignal() !== null);
  readonly activeClient = this.activeClientSignal.asReadonly();
  readonly clientDetail = this.detailSignal.asReadonly();
  readonly detailState = this.detailStateSignal.asReadonly();
  readonly entryEditorOpen = this.entryEditorOpenSignal.asReadonly();
  readonly entryEditorPayload = this.entryEditorPayloadSignal.asReadonly();
  readonly entryEditorVariant = this.entryEditorVariantSignal.asReadonly();
  readonly entryEditorHeadline = this.entryEditorHeadlineSignal.asReadonly();
  readonly entryEditorEyebrow = this.entryEditorEyebrowSignal.asReadonly();

  constructor() {
    this.queryControl.valueChanges
      .pipe(startWith(''), debounceTime(150), distinctUntilChanged())
      .subscribe((value) => this.querySignal.set(value));
  }

  statsSnapshot(): { totalClients: number; totalJobs: number; mostRecentDate: string | null; nextJobDate: string | null } {
    return this.stats();
  }

  filteredClientsSnapshot(): ClientSummary[] {
    return this.filteredClients();
  }

  loadStateSnapshot(): ClientsLoadState {
    return this.loadState();
  }

  async loadClients(): Promise<void> {
    this.loadStateSignal.set('loading');
    try {
      const clients = await this.repository.listClients();
      this.clientsSignal.set(clients);
      this.loadStateSignal.set('ready');
      const active = this.activeClientSignal();
      if (active) {
        const refreshed = clients.find((client) => client.clientId === active.clientId);
        if (refreshed) {
          this.activeClientSignal.set(refreshed);
        }
      }
    } catch (error) {
      console.warn('Failed to load clients roster', error);
      this.loadStateSignal.set('error');
    }
  }

  trackByClientId = (_: number, client: ClientSummary): string => client.clientId;

  async openClientDrawer(client: ClientSummary): Promise<void> {
    this.activeClientSignal.set(client);
    await this.fetchClientDetail(client);
  }

  async reloadClientDetail(): Promise<void> {
    const active = this.activeClientSignal();
    if (!active) {
      return;
    }
    await this.fetchClientDetail(active);
  }

  closeDrawer(): void {
    this.activeClientSignal.set(null);
    this.detailSignal.set(null);
    this.detailStateSignal.set('loading');
  }

  async handleClientUpdate(updates: UpdateClientPayload): Promise<void> {
    const active = this.activeClientSignal();
    if (!active) {
      return;
    }
    try {
      const summary = await this.repository.updateClient(active.clientId, updates);
      this.activeClientSignal.set(summary);
      await this.loadClients();
      await this.fetchClientDetail(summary);
    } catch (error) {
      console.warn('Failed to update client', error);
    }
  }

  async handleClientDelete(): Promise<void> {
    const active = this.activeClientSignal();
    if (!active) {
      return;
    }
    const confirmed = window.confirm(`Delete ${active.fullName}? This removes all jobs too.`);
    if (!confirmed) {
      return;
    }
    try {
      await this.repository.deleteClient(active.clientId);
      await this.loadClients();
      this.closeDrawer();
    } catch (error) {
      console.warn('Failed to delete client', error);
    }
  }

  openEntryEditor(history: ClientHistoryEntry): void {
    const active = this.activeClientSignal();
    if (!active) {
      return;
    }
    const payload = this.historyToPayload(history, active);
    this.entryEditorPayloadSignal.set(payload);
    this.entryEditorVariantSignal.set(history.variant);
    this.entryEditorHeadlineSignal.set(`Edit ${history.jobType}`);
    this.entryEditorEyebrowSignal.set(`${active.fullName} job`);
    this.entryEditorOpenSignal.set(true);
    this.editingEntryId = history.entryId;
  }

  closeEntryEditor(): void {
    this.entryEditorOpenSignal.set(false);
    this.entryEditorPayloadSignal.set(null);
    this.editingEntryId = null;
  }

  async handleEntryEditorSaved(payload: EntryModalPayload): Promise<void> {
    if (!this.editingEntryId) {
      this.closeEntryEditor();
      return;
    }
    try {
      await this.repository.updateEntry(this.editingEntryId, payload);
      await this.loadClients();
      await this.reloadClientDetail();
    } catch (error) {
      console.warn('Failed to update job entry', error);
    } finally {
      this.closeEntryEditor();
    }
  }

  async deleteHistoryEntry(history: ClientHistoryEntry): Promise<void> {
    const confirmed = window.confirm(`Delete job "${history.jobType}"?`);
    if (!confirmed) {
      return;
    }
    try {
      await this.repository.deleteEntry(history.entryId);
      await this.loadClients();
      await this.reloadClientDetail();
    } catch (error) {
      console.warn('Failed to delete entry', error);
    }
  }

  private async fetchClientDetail(client: ClientSummary): Promise<void> {
    const requestId = ++this.detailRequestId;
    this.detailSignal.set(null);
    this.detailStateSignal.set('loading');
    try {
      const detail = await this.repository.getClientDetail(client.clientId);
      if (requestId !== this.detailRequestId) {
        return;
      }
      this.detailSignal.set(detail);
      this.detailStateSignal.set('ready');
    } catch (error) {
      console.warn('Failed to load client detail', error);
      if (requestId !== this.detailRequestId) {
        return;
      }
      this.detailStateSignal.set('error');
    }
  }

  private filterClients(clients: ClientSummary[], rawQuery: string): ClientSummary[] {
    const rawTerm = rawQuery.trim();
    const term = rawTerm.toLowerCase();
    const digitsTerm = digitsOnly(rawTerm);
    if (!term) {
      return clients;
    }
    return clients.filter((client) => {
      const phoneDigits = digitsOnly(client.phone);
      const emailDigits = client.email ? digitsOnly(client.email) : '';
      return (
        client.fullName.toLowerCase().includes(term) ||
        client.address.toLowerCase().includes(term) ||
        client.phone.toLowerCase().includes(term) ||
        (client.email?.toLowerCase().includes(term) ?? false) ||
        (digitsTerm.length >= 3 && phoneDigits.includes(digitsTerm)) ||
        (digitsTerm.length >= 3 && emailDigits.includes(digitsTerm))
      );
    });
  }

  private computeStats(clients: ClientSummary[]): {
    totalClients: number;
    totalJobs: number;
    mostRecentDate: string | null;
    nextJobDate: string | null;
  } {
    const totalJobs = clients.reduce((acc, client) => acc + client.jobsCount, 0);
    const mostRecentDate = clients.reduce<string | null>((latest, client) => {
      if (!client.lastJobDate) {
        return latest;
      }
      if (!latest || client.lastJobDate > latest) {
        return client.lastJobDate;
      }
      return latest;
    }, null);
    const nextJobDate = clients.reduce<string | null>((soonest, client) => {
      if (!client.nextJobDate) {
        return soonest;
      }
      if (!soonest || client.nextJobDate < soonest) {
        return client.nextJobDate;
      }
      return soonest;
    }, null);
    return { totalClients: clients.length, totalJobs, mostRecentDate, nextJobDate };
  }

  private historyToPayload(history: ClientHistoryEntry, client: ClientSummary): EntryModalPayload {
    return {
      variant: history.variant,
      form: history.form ?? {
        firstName: client.firstName,
        lastName: client.lastName,
        address: history.location,
        phone: history.contactPhone,
        email: history.contactEmail,
        jobType: history.jobType,
        jobValue: history.jobValue,
        desiredBudget: history.desiredBudget,
        additionalDetails: history.additionalDetails,
      },
      hedges: history.hedges,
      calendar: history.calendar,
    };
  }
}
