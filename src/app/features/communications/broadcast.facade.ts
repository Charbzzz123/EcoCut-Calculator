import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs';
import {
  ClientSummary,
  EntryRepositoryService,
} from '@shared/domain/entry/entry-repository.service.js';
import {
  BroadcastChannel,
  BroadcastExclusionSummary,
  BroadcastFilters,
  BroadcastLoadState,
  BroadcastRecipientCounts,
  ServiceWindow,
  UpcomingWindow,
} from './broadcast.types.js';

const digitsOnly = (value: string): string => value.replace(/\D/g, '');

const hasEmail = (client: ClientSummary): boolean => Boolean(client.email?.trim());

const hasSmsPhone = (client: ClientSummary): boolean => digitsOnly(client.phone).length >= 10;

@Injectable({ providedIn: 'root' })
export class BroadcastFacade {
  private readonly repository = inject(EntryRepositoryService);

  readonly queryControl = new FormControl('', { nonNullable: true });
  readonly requireEmailControl = new FormControl(false, { nonNullable: true });
  readonly requirePhoneControl = new FormControl(false, { nonNullable: true });
  readonly serviceWindowControl = new FormControl<ServiceWindow>('any', { nonNullable: true });
  readonly upcomingWindowControl = new FormControl<UpcomingWindow>('any', { nonNullable: true });
  readonly channelControl = new FormControl<BroadcastChannel>('both', { nonNullable: true });

  private readonly clientsSignal = this.createClientsSignal();
  private readonly loadStateSignal = this.createLoadStateSignal();
  private readonly filtersSignal = this.createFiltersSignal();
  private readonly selectedChannelSignal = this.createSelectedChannelSignal();

  readonly loadState: Signal<BroadcastLoadState> = this.loadStateSignal.asReadonly();
  readonly selectedChannel: Signal<BroadcastChannel> = this.selectedChannelSignal.asReadonly();
  /* c8 ignore next */
  readonly filteredRecipients: Signal<ClientSummary[]> = computed(() =>
    this.applyFilters(this.clientsSignal(), this.filtersSignal()),
  );
  /* c8 ignore next */
  readonly counts: Signal<BroadcastRecipientCounts> = computed(() =>
    this.computeCounts(this.filteredRecipients()),
  );
  /* c8 ignore next */
  readonly exclusionSummary: Signal<BroadcastExclusionSummary> = computed(() =>
    this.computeExclusions(this.filteredRecipients(), this.counts(), this.selectedChannelSignal()),
  );
  /* c8 ignore next */
  readonly channelValidationMessage: Signal<string | null> = computed(() =>
    this.computeChannelValidation(this.counts(), this.selectedChannelSignal()),
  );
  /* c8 ignore next */
  readonly canDispatch: Signal<boolean> = computed(() => this.channelValidationMessage() === null);

  constructor() {
    this.queryControl.valueChanges
      .pipe(startWith(this.queryControl.value), debounceTime(150), distinctUntilChanged())
      .subscribe((query) => this.updateFilters({ query }));
    this.requireEmailControl.valueChanges
      .pipe(startWith(this.requireEmailControl.value), distinctUntilChanged())
      .subscribe((requireEmail) => this.updateFilters({ requireEmail }));
    this.requirePhoneControl.valueChanges
      .pipe(startWith(this.requirePhoneControl.value), distinctUntilChanged())
      .subscribe((requirePhone) => this.updateFilters({ requirePhone }));
    this.serviceWindowControl.valueChanges
      .pipe(startWith(this.serviceWindowControl.value), distinctUntilChanged())
      .subscribe((serviceWindow) => this.updateFilters({ serviceWindow }));
    this.upcomingWindowControl.valueChanges
      .pipe(startWith(this.upcomingWindowControl.value), distinctUntilChanged())
      .subscribe((upcomingWindow) => this.updateFilters({ upcomingWindow }));
    this.channelControl.valueChanges
      .pipe(startWith(this.channelControl.value), distinctUntilChanged())
      .subscribe((channel) => this.selectedChannelSignal.set(channel));
  }

  async loadRecipients(): Promise<void> {
    this.loadStateSignal.set('loading');
    try {
      this.clientsSignal.set(await this.repository.listClients());
      this.loadStateSignal.set('ready');
    } catch (error) {
      console.warn('Failed to load broadcast recipients', error);
      this.clientsSignal.set([]);
      this.loadStateSignal.set('error');
    }
  }

  filteredRecipientsSnapshot(): ClientSummary[] {
    return this.filteredRecipients();
  }

  countsSnapshot(): BroadcastRecipientCounts {
    return this.counts();
  }

  exclusionSummarySnapshot(): BroadcastExclusionSummary {
    return this.exclusionSummary();
  }

  private updateFilters(partial: Partial<BroadcastFilters>): void {
    this.filtersSignal.update((current) => ({ ...current, ...partial }));
  }

  private applyFilters(clients: ClientSummary[], filters: BroadcastFilters): ClientSummary[] {
    const term = filters.query.trim().toLowerCase();
    const digitTerm = digitsOnly(filters.query);
    const now = Date.now();
    return clients.filter((client) => {
      if (term) {
        const matchesTerm =
          client.fullName.toLowerCase().includes(term) ||
          client.address.toLowerCase().includes(term) ||
          client.phone.toLowerCase().includes(term) ||
          (client.email?.toLowerCase().includes(term) ?? false);
        const matchesDigits =
          digitTerm.length >= 3 &&
          (digitsOnly(client.phone).includes(digitTerm) ||
            (client.email ? digitsOnly(client.email).includes(digitTerm) : false));
        if (!matchesTerm && !matchesDigits) {
          return false;
        }
      }

      if (filters.requireEmail && !hasEmail(client)) {
        return false;
      }

      if (filters.requirePhone && !hasSmsPhone(client)) {
        return false;
      }

      if (!this.matchesServiceWindow(client.lastJobDate, filters.serviceWindow, now)) {
        return false;
      }

      if (!this.matchesUpcomingWindow(client.nextJobDate ?? null, filters.upcomingWindow, now)) {
        return false;
      }

      return true;
    });
  }

  private matchesServiceWindow(
    lastJobDate: string | null,
    window: ServiceWindow,
    now: number,
  ): boolean {
    if (window === 'any') {
      return true;
    }
    if (window === 'no-history') {
      return !lastJobDate;
    }
    if (!lastJobDate) {
      return false;
    }
    const timestamp = Date.parse(lastJobDate);
    if (Number.isNaN(timestamp)) {
      return false;
    }
    const days = window === 'last-90' ? 90 : 365;
    return now - timestamp <= days * 24 * 60 * 60 * 1000;
  }

  private matchesUpcomingWindow(
    nextJobDate: string | null,
    window: UpcomingWindow,
    now: number,
  ): boolean {
    if (window === 'any') {
      return true;
    }
    if (window === 'no-upcoming') {
      return !nextJobDate;
    }
    if (!nextJobDate) {
      return false;
    }
    const timestamp = Date.parse(nextJobDate);
    if (Number.isNaN(timestamp) || timestamp < now) {
      return false;
    }
    const days = window === 'next-30' ? 30 : 90;
    return timestamp - now <= days * 24 * 60 * 60 * 1000;
  }

  private computeCounts(filteredRecipients: ClientSummary[]): BroadcastRecipientCounts {
    return filteredRecipients.reduce<BroadcastRecipientCounts>(
      (totals, client) => {
        const emailEligible = hasEmail(client);
        const smsEligible = hasSmsPhone(client);
        totals.total += 1;
        totals.emailEligible += emailEligible ? 1 : 0;
        totals.smsEligible += smsEligible ? 1 : 0;
        totals.bothEligible += emailEligible && smsEligible ? 1 : 0;
        return totals;
      },
      { total: 0, emailEligible: 0, smsEligible: 0, bothEligible: 0 },
    );
  }

  private computeExclusions(
    filteredRecipients: ClientSummary[],
    counts: BroadcastRecipientCounts,
    channel: BroadcastChannel,
  ): BroadcastExclusionSummary {
    const missingEmail = filteredRecipients.filter((client) => !hasEmail(client)).length;
    const missingPhone = filteredRecipients.filter((client) => !hasSmsPhone(client)).length;
    const missingBoth = filteredRecipients.filter(
      (client) => !hasEmail(client) && !hasSmsPhone(client),
    ).length;
    let excludedForSelectedChannel = 0;
    if (channel === 'email') {
      excludedForSelectedChannel = counts.total - counts.emailEligible;
    } else if (channel === 'sms') {
      excludedForSelectedChannel = counts.total - counts.smsEligible;
    } else {
      excludedForSelectedChannel = counts.total - counts.bothEligible;
    }
    return { missingEmail, missingPhone, missingBoth, excludedForSelectedChannel };
  }

  private computeChannelValidation(
    counts: BroadcastRecipientCounts,
    channel: BroadcastChannel,
  ): string | null {
    if (counts.total === 0) {
      return 'No recipients match the current filters.';
    }
    if (channel === 'email' && counts.emailEligible === 0) {
      return 'No recipients have an email address for the selected filters.';
    }
    if (channel === 'sms' && counts.smsEligible === 0) {
      return 'No recipients have an SMS-capable phone number for the selected filters.';
    }
    if (channel === 'both' && counts.bothEligible === 0) {
      return 'No recipients can receive both email and SMS for the selected filters.';
    }
    return null;
  }

  private createClientsSignal(): WritableSignal<ClientSummary[]> {
    return signal<ClientSummary[]>([]);
  }

  private createLoadStateSignal(): WritableSignal<BroadcastLoadState> {
    return signal<BroadcastLoadState>('loading');
  }

  private createFiltersSignal(): WritableSignal<BroadcastFilters> {
    return signal<BroadcastFilters>({
      query: '',
      requireEmail: false,
      requirePhone: false,
      serviceWindow: 'any',
      upcomingWindow: 'any',
    });
  }

  private createSelectedChannelSignal(): WritableSignal<BroadcastChannel> {
    return signal<BroadcastChannel>('both');
  }
}
