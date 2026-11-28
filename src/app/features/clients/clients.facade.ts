import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs';
import { HomeDataService } from '@features/home/home-data.service.js';
import { CalendarEventsService } from '@shared/domain/entry/calendar-events.service.js';
import { buildCalendarEventRequest } from '@shared/domain/entry/calendar-event.builder.js';
import {
  ClientDetail,
  ClientHistoryEntry,
  ClientSummary,
  EntryRepositoryService,
  UpdateClientPayload,
} from '@shared/domain/entry/entry-repository.service.js';
import type {
  EntryModalPayload,
  EntryVariant,
  SalesStatus,
} from '@shared/domain/entry/entry-modal.models.js';
import type { ClientDetailState, ClientsLoadState } from './clients.types.js';

const digitsOnly = (value: string): string => value.replace(/\D/g, '');

@Injectable({ providedIn: 'root' })
export class ClientsFacade {
  private readonly repository = inject(EntryRepositoryService);
  private readonly calendar = inject(CalendarEventsService);
  private readonly homeData = inject(HomeDataService);

  readonly headingId = 'client-roster-heading';
  readonly queryControl = new FormControl('', { nonNullable: true });

  private readonly querySignal: WritableSignal<string>;
  private readonly clientsSignal: WritableSignal<ClientSummary[]>;
  private readonly loadStateSignal: WritableSignal<ClientsLoadState>;
  private readonly activeClientSignal: WritableSignal<ClientSummary | null>;
  private readonly detailSignal: WritableSignal<ClientDetail | null>;
  private readonly detailStateSignal: WritableSignal<ClientDetailState>;
  private readonly entryEditorOpenSignal: WritableSignal<boolean>;
  private readonly entryEditorPayloadSignal: WritableSignal<EntryModalPayload | null>;
  private readonly entryEditorVariantSignal: WritableSignal<EntryVariant>;
  private readonly entryEditorHeadlineSignal: WritableSignal<string>;
  private readonly entryEditorEyebrowSignal: WritableSignal<string>;
  private readonly entryEditorScheduleOnlySignal: WritableSignal<boolean>;
  private detailRequestId = 0;
  private editingEntryId: string | null = null;
  private editorAction: 'edit' | 'accept' | 'duplicate' | null = null;
  readonly updatingSalesStatusEntryId = signal<string | null>(null);
  readonly salesStatusError = signal<string | null>(null);

  readonly loadState: Signal<ClientsLoadState>;
  readonly filteredClients: Signal<ClientSummary[]>;
  readonly stats: Signal<{
    totalClients: number;
    totalJobs: number;
    openOpportunities: number;
    toSchedule: number;
    mostRecentDate: string | null;
    nextJobDate: string | null;
  }>;
  readonly drawerVisible: Signal<boolean>;
  readonly activeClient: Signal<ClientSummary | null>;
  readonly clientDetail: Signal<ClientDetail | null>;
  readonly detailState: Signal<ClientDetailState>;
  readonly entryEditorOpen: Signal<boolean>;
  readonly entryEditorPayload: Signal<EntryModalPayload | null>;
  readonly entryEditorVariant: Signal<EntryVariant>;
  readonly entryEditorHeadline: Signal<string>;
  readonly entryEditorEyebrow: Signal<string>;
  readonly entryEditorScheduleOnly: Signal<boolean>;

  /* c8 ignore start */
  constructor() {
    this.querySignal = signal('');
    this.clientsSignal = signal<ClientSummary[]>([]);
    this.loadStateSignal = signal<ClientsLoadState>('loading');
    this.activeClientSignal = signal<ClientSummary | null>(null);
    this.detailSignal = signal<ClientDetail | null>(null);
    this.detailStateSignal = signal<ClientDetailState>('loading');
    this.entryEditorOpenSignal = signal(false);
    this.entryEditorPayloadSignal = signal<EntryModalPayload | null>(null);
    this.entryEditorVariantSignal = signal<EntryVariant>('warm-lead');
    this.entryEditorHeadlineSignal = signal('Edit job');
    this.entryEditorEyebrowSignal = signal('Client job');
    this.entryEditorScheduleOnlySignal = signal(false);

    this.loadState = this.loadStateSignal.asReadonly();
    this.filteredClients = computed(() =>
      this.filterClients(this.clientsSignal(), this.querySignal()),
    );
    this.stats = computed(() => this.computeStats(this.clientsSignal()));
    this.drawerVisible = computed(() => this.activeClientSignal() !== null);
    /* c8 ignore stop */
    this.activeClient = this.activeClientSignal.asReadonly();
    this.clientDetail = this.detailSignal.asReadonly();
    this.detailState = this.detailStateSignal.asReadonly();
    this.entryEditorOpen = this.entryEditorOpenSignal.asReadonly();
    this.entryEditorPayload = this.entryEditorPayloadSignal.asReadonly();
    this.entryEditorVariant = this.entryEditorVariantSignal.asReadonly();
    this.entryEditorHeadline = this.entryEditorHeadlineSignal.asReadonly();
    this.entryEditorEyebrow = this.entryEditorEyebrowSignal.asReadonly();
    this.entryEditorScheduleOnly = this.entryEditorScheduleOnlySignal.asReadonly();

    this.queryControl.valueChanges
      .pipe(startWith(''), debounceTime(150), distinctUntilChanged())
      .subscribe((value) => this.querySignal.set(value));
  }
  /* c8 ignore stop */

  statsSnapshot(): {
    totalClients: number;
    totalJobs: number;
    openOpportunities: number;
    toSchedule: number;
    mostRecentDate: string | null;
    nextJobDate: string | null;
  } {
    return this.stats();
  }

  filteredClientsSnapshot(): ClientSummary[] {
    return this.filteredClients();
  }

  loadStateSnapshot(): ClientsLoadState {
    return this.loadState();
  }

  entryEditorPrimaryActionLabel(): string {
    return this.editorAction === 'duplicate' ? 'Save Customer' : 'Update job';
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
        } else {
          this.closeDrawer();
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
    this.entryEditorScheduleOnlySignal.set(false);
    this.entryEditorOpenSignal.set(true);
    this.editingEntryId = history.entryId;
    this.editorAction = 'edit';
  }

  copyCompletedEntry(history: ClientHistoryEntry): void {
    const active = this.activeClientSignal();
    if (!active || history.execution?.status !== 'completed') {
      return;
    }
    const payload = this.historyToPayload(history, active);
    payload.variant = 'customer';
    payload.followUpNote = undefined;
    if (payload.calendar) {
      payload.calendar = {
        ...payload.calendar,
        start: this.shiftDateToNextYear(payload.calendar.start),
        end: this.shiftDateToNextYear(payload.calendar.end),
        eventId: undefined,
      };
    }
    this.entryEditorPayloadSignal.set(payload);
    this.entryEditorVariantSignal.set(payload.variant);
    this.entryEditorHeadlineSignal.set(`Copy ${history.jobType} for next year`);
    this.entryEditorEyebrowSignal.set(`${active.fullName} · new job`);
    this.entryEditorScheduleOnlySignal.set(false);
    this.entryEditorOpenSignal.set(true);
    this.editingEntryId = null;
    this.editorAction = 'duplicate';
  }

  closeEntryEditor(): void {
    this.entryEditorOpenSignal.set(false);
    this.entryEditorPayloadSignal.set(null);
    this.editingEntryId = null;
    this.entryEditorScheduleOnlySignal.set(false);
    this.editorAction = null;
  }

  async handleEntryEditorSaved(payload: EntryModalPayload): Promise<void> {
    const action = this.editorAction;
    if (action === 'accept' && this.editingEntryId) {
      await this.saveAcceptedOpportunity(this.editingEntryId, payload);
      this.closeEntryEditor();
      return;
    }
    if (action === 'duplicate') {
      try {
        await this.homeData.saveEntry(payload);
        await this.loadClients();
        await this.reloadClientDetail();
      } catch (error) {
        console.warn('Could not create next-year job copy', error);
        this.salesStatusError.set(
          'Could not create the new job. Check your connection and try again.',
        );
      } finally {
        this.closeEntryEditor();
      }
      return;
    }
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

  async changeSalesStatus(history: ClientHistoryEntry, salesStatus: SalesStatus): Promise<void> {
    const currentStatus = this.resolveSalesStatus(history);
    if (salesStatus === 'accepted') {
      if (
        currentStatus !== 'accepted' ||
        (!history.calendar && history.execution?.status !== 'completed')
      ) {
        this.openAcceptanceEditor(history);
      }
      return;
    }
    if (currentStatus === salesStatus) {
      return;
    }
    const confirmation =
      salesStatus === 'not-proceeding'
        ? 'Mark this opportunity as not proceeding? It stays in history and stops appearing as open.'
        : 'Reopen this opportunity? It will appear in the open follow-ups again.';
    const confirmed = window.confirm(confirmation);
    if (!confirmed) {
      return;
    }
    this.salesStatusError.set(null);
    this.updatingSalesStatusEntryId.set(history.entryId);
    try {
      if (history.calendar?.eventId) {
        await this.calendar.deleteEvent(history.calendar.eventId);
      }
      await this.repository.updateSalesStatus(history.entryId, {
        salesStatus,
        calendar: null,
        followUpNote: null,
      });
      await this.loadClients();
      await this.reloadClientDetail();
    } catch (error) {
      console.warn('Failed to update opportunity status', error);
      this.salesStatusError.set(
        'Could not update this opportunity. Check your connection and try again.',
      );
    } finally {
      this.updatingSalesStatusEntryId.set(null);
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
    openOpportunities: number;
    toSchedule: number;
    mostRecentDate: string | null;
    nextJobDate: string | null;
  } {
    const totalJobs = clients.reduce((acc, client) => acc + client.jobsCount, 0);
    const openOpportunities = clients.reduce(
      (acc, client) => acc + (client.openOpportunityCount ?? 0),
      0,
    );
    const toSchedule = clients.reduce((acc, client) => acc + (client.toScheduleCount ?? 0), 0);
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
    return {
      totalClients: clients.length,
      totalJobs,
      openOpportunities,
      toSchedule,
      mostRecentDate,
      nextJobDate,
    };
  }

  private resolveSalesStatus(history: ClientHistoryEntry): SalesStatus {
    return history.salesStatus ?? (history.variant === 'customer' ? 'accepted' : 'open');
  }

  private historyToPayload(history: ClientHistoryEntry, client: ClientSummary): EntryModalPayload {
    return {
      variant: history.variant,
      followUpNote: history.followUpNote,
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

  private openAcceptanceEditor(history: ClientHistoryEntry): void {
    const active = this.activeClientSignal();
    if (!active) return;
    const payload = this.historyToPayload(history, active);
    payload.variant = 'customer';
    payload.calendar = undefined;
    this.entryEditorPayloadSignal.set(payload);
    this.entryEditorVariantSignal.set('customer');
    this.entryEditorHeadlineSignal.set('Accept opportunity');
    this.entryEditorEyebrowSignal.set(`${active.fullName} · ${history.jobType}`);
    this.entryEditorScheduleOnlySignal.set(true);
    this.entryEditorOpenSignal.set(true);
    this.editingEntryId = history.entryId;
    this.editorAction = 'accept';
  }

  private async saveAcceptedOpportunity(
    entryId: string,
    payload: EntryModalPayload,
  ): Promise<void> {
    this.salesStatusError.set(null);
    this.updatingSalesStatusEntryId.set(entryId);
    let createdEventId: string | null = null;
    try {
      const calendarRequest = buildCalendarEventRequest(payload);
      let calendarPayload = payload.calendar ?? null;
      if (calendarRequest && calendarPayload) {
        const createdEvent = await this.calendar.createEvent(calendarRequest);
        createdEventId = createdEvent.id;
        calendarPayload = { ...calendarPayload, eventId: createdEvent.id };
      }
      await this.repository.updateSalesStatus(entryId, {
        salesStatus: 'accepted',
        calendar: calendarPayload,
        followUpNote: payload.followUpNote ?? null,
      });
      await this.loadClients();
      await this.reloadClientDetail();
    } catch (error) {
      if (createdEventId) {
        try {
          await this.calendar.deleteEvent(createdEventId);
        } catch (cleanupError) {
          console.error('Could not remove calendar event after failed acceptance', cleanupError);
        }
      }
      console.warn('Could not accept opportunity', error);
      this.salesStatusError.set(
        'Could not save acceptance. The job is still open; please try again.',
      );
    } finally {
      this.updatingSalesStatusEntryId.set(null);
    }
  }

  private shiftDateToNextYear(value: string): string {
    const date = new Date(value);
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString();
  }
}
