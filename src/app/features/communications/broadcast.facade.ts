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
  BroadcastMergeField,
  BroadcastLoadState,
  BroadcastRecipientCounts,
  BroadcastSmsMetrics,
  BroadcastTemplateTarget,
  BroadcastTemplates,
  BroadcastPreviewPayload,
  ServiceWindow,
  UpcomingWindow,
} from './broadcast.types.js';

const digitsOnly = (value: string): string => value.replace(/\D/g, '');

const hasEmail = (client: ClientSummary): boolean => Boolean(client.email?.trim());

const hasSmsPhone = (client: ClientSummary): boolean => digitsOnly(client.phone).length >= 10;

const formatDate = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const mergeFields: BroadcastMergeField[] = [
  { key: 'firstName', token: '{{firstName}}', label: 'First name', fallbackLabel: 'there' },
  { key: 'fullName', token: '{{fullName}}', label: 'Full name', fallbackLabel: 'Valued client' },
  { key: 'address', token: '{{address}}', label: 'Address', fallbackLabel: 'your property' },
  { key: 'phone', token: '{{phone}}', label: 'Phone', fallbackLabel: 'no phone on file' },
  { key: 'email', token: '{{email}}', label: 'Email', fallbackLabel: 'no email on file' },
  { key: 'jobsCount', token: '{{jobsCount}}', label: 'Jobs count', fallbackLabel: '0' },
  {
    key: 'lastJobDate',
    token: '{{lastJobDate}}',
    label: 'Last job date',
    fallbackLabel: 'not on file',
  },
  {
    key: 'nextJobDate',
    token: '{{nextJobDate}}',
    label: 'Next job date',
    fallbackLabel: 'not scheduled',
  },
];

const defaultTemplates: BroadcastTemplates = {
  emailSubject: 'EcoCut update for {{firstName}}',
  emailBody:
    'Hi {{firstName}},\n\nWe loved servicing {{address}}. Your last visit was {{lastJobDate}}.\n\n- EcoCut Team',
  smsBody: 'Hi {{firstName}} - EcoCut here. Want to schedule your next visit at {{address}}?',
  ctaLink: '',
  internalNote: '',
};

@Injectable({ providedIn: 'root' })
export class BroadcastFacade {
  private readonly repository = inject(EntryRepositoryService);

  readonly queryControl = new FormControl('', { nonNullable: true });
  readonly requireEmailControl = new FormControl(false, { nonNullable: true });
  readonly requirePhoneControl = new FormControl(false, { nonNullable: true });
  readonly serviceWindowControl = new FormControl<ServiceWindow>('any', { nonNullable: true });
  readonly upcomingWindowControl = new FormControl<UpcomingWindow>('any', { nonNullable: true });
  readonly channelControl = new FormControl<BroadcastChannel>('both', { nonNullable: true });
  readonly emailSubjectControl = new FormControl(defaultTemplates.emailSubject, {
    nonNullable: true,
  });
  readonly emailBodyControl = new FormControl(defaultTemplates.emailBody, { nonNullable: true });
  readonly smsBodyControl = new FormControl(defaultTemplates.smsBody, { nonNullable: true });
  readonly ctaLinkControl = new FormControl(defaultTemplates.ctaLink, { nonNullable: true });
  readonly internalNoteControl = new FormControl(defaultTemplates.internalNote, { nonNullable: true });
  readonly previewClientIdControl = new FormControl('', { nonNullable: true });

  private readonly clientsSignal = this.createClientsSignal();
  private readonly loadStateSignal = this.createLoadStateSignal();
  private readonly filtersSignal = this.createFiltersSignal();
  private readonly selectedChannelSignal = this.createSelectedChannelSignal();
  private readonly templatesSignal = this.createTemplatesSignal();
  private readonly previewClientIdSignal = this.createPreviewClientIdSignal();

  readonly loadState: Signal<BroadcastLoadState> = this.loadStateSignal.asReadonly();
  readonly selectedChannel: Signal<BroadcastChannel> = this.selectedChannelSignal.asReadonly();
  readonly mergeFields: Signal<BroadcastMergeField[]> = signal(mergeFields).asReadonly();
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
  readonly templates: Signal<BroadcastTemplates> = this.templatesSignal.asReadonly();
  /* c8 ignore next */
  readonly previewPayload: Signal<BroadcastPreviewPayload> = computed(() =>
    this.buildPreviewPayload(this.filteredRecipients(), this.previewClientIdSignal(), this.templatesSignal()),
  );
  /* c8 ignore next */
  readonly smsMetrics: Signal<BroadcastSmsMetrics> = computed(() =>
    this.computeSmsMetrics(this.previewPayload().smsBody),
  );

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
    this.emailSubjectControl.valueChanges
      .pipe(startWith(this.emailSubjectControl.value), distinctUntilChanged())
      .subscribe((emailSubject) => this.updateTemplates({ emailSubject }));
    this.emailBodyControl.valueChanges
      .pipe(startWith(this.emailBodyControl.value), distinctUntilChanged())
      .subscribe((emailBody) => this.updateTemplates({ emailBody }));
    this.smsBodyControl.valueChanges
      .pipe(startWith(this.smsBodyControl.value), distinctUntilChanged())
      .subscribe((smsBody) => this.updateTemplates({ smsBody }));
    this.ctaLinkControl.valueChanges
      .pipe(startWith(this.ctaLinkControl.value), distinctUntilChanged())
      .subscribe((ctaLink) => this.updateTemplates({ ctaLink }));
    this.internalNoteControl.valueChanges
      .pipe(startWith(this.internalNoteControl.value), distinctUntilChanged())
      .subscribe((internalNote) => this.updateTemplates({ internalNote }));
    this.previewClientIdControl.valueChanges
      .pipe(startWith(this.previewClientIdControl.value), distinctUntilChanged())
      .subscribe((previewClientId) => this.previewClientIdSignal.set(previewClientId));
  }

  async loadRecipients(): Promise<void> {
    this.loadStateSignal.set('loading');
    try {
      this.clientsSignal.set(await this.repository.listClients());
      this.syncPreviewSelection();
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

  insertMergeField(target: BroadcastTemplateTarget, token: string): void {
    const control = this.resolveTemplateControl(target);
    const value = control.value;
    const appendWithSpace =
      value.length > 0 && !value.endsWith(' ') && !value.endsWith('\n');
    control.setValue(`${value}${appendWithSpace ? ' ' : ''}${token}`);
  }

  private updateFilters(partial: Partial<BroadcastFilters>): void {
    this.filtersSignal.update((current) => ({ ...current, ...partial }));
    this.syncPreviewSelection();
  }

  private updateTemplates(partial: Partial<BroadcastTemplates>): void {
    this.templatesSignal.update((current) => ({ ...current, ...partial }));
  }

  private syncPreviewSelection(): void {
    const filteredRecipients = this.filteredRecipients();
    const currentPreviewId = this.previewClientIdSignal();
    if (filteredRecipients.length === 0) {
      this.previewClientIdSignal.set('');
      this.previewClientIdControl.setValue('', { emitEvent: false });
      return;
    }
    if (currentPreviewId && filteredRecipients.some((client) => client.clientId === currentPreviewId)) {
      return;
    }
    const nextId = filteredRecipients[0].clientId;
    this.previewClientIdSignal.set(nextId);
    this.previewClientIdControl.setValue(nextId, { emitEvent: false });
  }

  private buildPreviewPayload(
    filteredRecipients: ClientSummary[],
    previewClientId: string,
    templates: BroadcastTemplates,
  ): BroadcastPreviewPayload {
    const selectedClient =
      filteredRecipients.find((client) => client.clientId === previewClientId) ?? null;
    return {
      clientId: selectedClient?.clientId ?? null,
      clientLabel: selectedClient?.fullName ?? 'No recipient selected',
      emailSubject: this.applyMergeFields(templates.emailSubject, selectedClient),
      emailBody: this.applyMergeFields(templates.emailBody, selectedClient),
      smsBody: this.applyMergeFields(templates.smsBody, selectedClient),
    };
  }

  private applyMergeFields(template: string, client: ClientSummary | null): string {
    const map = this.buildMergeMap(client);
    return mergeFields.reduce((output, field) => output.replaceAll(field.token, map[field.key]), template);
  }

  private buildMergeMap(client: ClientSummary | null): Record<string, string> {
    return {
      firstName: client?.firstName?.trim() || 'there',
      fullName: client?.fullName?.trim() || 'Valued client',
      address: client?.address?.trim() || 'your property',
      phone: client?.phone?.trim() || 'no phone on file',
      email: client?.email?.trim() || 'no email on file',
      jobsCount: client ? String(client.jobsCount) : '0',
      lastJobDate: formatDate(client?.lastJobDate) || 'not on file',
      nextJobDate: formatDate(client?.nextJobDate) || 'not scheduled',
    };
  }

  private resolveTemplateControl(target: BroadcastTemplateTarget): FormControl<string> {
    if (target === 'emailSubject') {
      return this.emailSubjectControl;
    }
    if (target === 'smsBody') {
      return this.smsBodyControl;
    }
    return this.emailBodyControl;
  }

  private computeSmsMetrics(message: string): BroadcastSmsMetrics {
    const characters = message.length;
    const segments = characters === 0 ? 0 : Math.ceil(characters / 160);
    return { characters, segments };
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

  private createTemplatesSignal(): WritableSignal<BroadcastTemplates> {
    return signal<BroadcastTemplates>(defaultTemplates);
  }

  private createPreviewClientIdSignal(): WritableSignal<string> {
    return signal('');
  }
}
