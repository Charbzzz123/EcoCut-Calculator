import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs';
import {
  ClientSummary,
  EntryRepositoryService,
} from '@shared/domain/entry/entry-repository.service.js';
import {
  BroadcastDeliveryService,
  type BroadcastDispatchRecipient,
  type BroadcastDispatchRequest,
  type BroadcastTestRequest,
} from '@shared/domain/communications/broadcast-delivery.service.js';
import {
  BroadcastChannel,
  BroadcastConfirmationPayload,
  BroadcastExclusionSummary,
  BroadcastFilters,
  BroadcastMergeField,
  BroadcastLoadState,
  BroadcastLayerOption,
  BroadcastRecipientCounts,
  BroadcastScheduleMode,
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

const mergeFieldEditorToken = (field: BroadcastMergeField): string => `[[${field.label}]]`;

const defaultTemplates: BroadcastTemplates = {
  emailSubject: 'EcoCut update for {{firstName}}',
  emailBody:
    'Hi {{firstName}},\n\nWe loved servicing {{address}}. Your last visit was {{lastJobDate}}.\n\n- EcoCut Team',
  smsBody: 'Hi {{firstName}} - EcoCut here. Want to schedule your next visit at {{address}}?',
  ctaLink: '',
  internalNote: '',
};

interface BroadcastTemplateLayer {
  emailSubject?: string;
  emailBody?: string;
  smsBody?: string;
}

interface SegmentRuleDefinition extends BroadcastLayerOption {
  matches: (client: ClientSummary) => boolean;
  layer: BroadcastTemplateLayer;
}

interface ChannelVariantDefinition extends BroadcastLayerOption {
  layer: BroadcastTemplateLayer;
}

export type ManualRecipientAddResult = 'added' | 'already-selected' | 'not-found';

const channelEmailVariants: ChannelVariantDefinition[] = [
  { id: 'default', label: 'Default email copy', layer: {} },
  {
    id: 'promo',
    label: 'Seasonal promo emphasis',
    layer: {
      emailSubject: 'Seasonal offer for {{firstName}}',
      emailBody:
        'Hi {{firstName}},\n\nSeasonal booking is now open for {{address}}. Reply early to secure your preferred slot.\n\n- EcoCut Team',
    },
  },
  {
    id: 'follow-up',
    label: 'Follow-up reminder',
    layer: {
      emailSubject: 'Quick follow-up for {{firstName}}',
      emailBody:
        'Hi {{firstName}},\n\nWe are following up on your property at {{address}}. Let us know if you want a fresh quote this week.\n\n- EcoCut Team',
    },
  },
  {
    id: 'priority-tag',
    label: 'Priority tag only',
    layer: {},
  },
];

const channelSmsVariants: ChannelVariantDefinition[] = [
  { id: 'default', label: 'Default SMS copy', layer: {} },
  {
    id: 'promo',
    label: 'Promo SMS',
    layer: { smsBody: 'Hi {{firstName}} - EcoCut promo: save on your next visit at {{address}}.' },
  },
  {
    id: 'follow-up',
    label: 'Follow-up SMS',
    layer: { smsBody: 'Hi {{firstName}} - just checking in for {{address}}. Reply YES for a callback.' },
  },
  {
    id: 'priority-window',
    label: 'Priority window tag',
    layer: {},
  },
];

const segmentRules: SegmentRuleDefinition[] = [
  {
    id: 'none',
    label: 'No segment rule',
    /* c8 ignore next */
    matches: () => false,
    layer: {},
  },
  {
    id: 'inactive-90',
    label: 'Inactive 90+ days',
    matches: (client) => {
      if (!client.lastJobDate) {
        return false;
      }
      const lastJob = Date.parse(client.lastJobDate);
      if (Number.isNaN(lastJob)) {
        return false;
      }
      return Date.now() - lastJob > 90 * 24 * 60 * 60 * 1000;
    },
    layer: {
      emailBody:
        'Hi {{firstName}},\n\nIt has been a while since your last service at {{address}}. We can reserve a returning-client slot for you.\n\n- EcoCut Team',
      smsBody: 'Hi {{firstName}} - we have not seen {{address}} in a while. Want a returning-client slot?',
    },
  },
  {
    id: 'upcoming-30',
    label: 'Upcoming job in next 30 days',
    matches: (client) => {
      if (!client.nextJobDate) {
        return false;
      }
      const nextJob = Date.parse(client.nextJobDate);
      if (Number.isNaN(nextJob)) {
        return false;
      }
      const delta = nextJob - Date.now();
      return delta >= 0 && delta <= 30 * 24 * 60 * 60 * 1000;
    },
    layer: {
      emailBody:
        'Hi {{firstName}},\n\nYour next visit is currently planned for {{nextJobDate}}. Reply if you need any adjustments before the crew arrives.\n\n- EcoCut Team',
      smsBody: 'Hi {{firstName}} - reminder: your next EcoCut visit is {{nextJobDate}}. Reply to adjust.',
    },
  },
  {
    id: 'high-frequency',
    label: 'High-frequency clients (3+ jobs)',
    matches: (client) => client.jobsCount >= 3,
    layer: {
      emailSubject: 'Priority update for {{firstName}}',
      emailBody:
        'Hi {{firstName}},\n\nThanks for trusting EcoCut for {{jobsCount}} jobs. We can reserve priority booking for {{address}}.\n\n- EcoCut Team',
      smsBody:
        'Hi {{firstName}} - thanks for being a repeat client. Priority booking is available for {{address}}.',
    },
  },
  {
    id: 'subject-only',
    label: 'Subject-only priority layer',
    matches: (client) => client.jobsCount >= 3,
    layer: {
      emailSubject: 'Priority check-in for {{firstName}}',
    },
  },
];

@Injectable({ providedIn: 'root' })
export class BroadcastFacade {
  private readonly repository = inject(EntryRepositoryService);
  private readonly delivery = inject(BroadcastDeliveryService);

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
  readonly emailVariantControl = new FormControl('default', { nonNullable: true });
  readonly smsVariantControl = new FormControl('default', { nonNullable: true });
  readonly segmentRuleControl = new FormControl('none', { nonNullable: true });
  readonly overrideSubjectControl = new FormControl('', { nonNullable: true });
  readonly overrideEmailBodyControl = new FormControl('', { nonNullable: true });
  readonly overrideSmsBodyControl = new FormControl('', { nonNullable: true });
  readonly scheduleModeControl = new FormControl<BroadcastScheduleMode>('now', { nonNullable: true });
  readonly scheduleAtControl = new FormControl('', { nonNullable: true });
  readonly testEmailControl = new FormControl('', { nonNullable: true });
  readonly testPhoneControl = new FormControl('', { nonNullable: true });

  private readonly clientsSignal = this.createClientsSignal();
  private readonly manualRecipientIdsSignal = this.createManualRecipientIdsSignal();
  private readonly loadStateSignal = this.createLoadStateSignal();
  private readonly filtersSignal = this.createFiltersSignal();
  private readonly selectedChannelSignal = this.createSelectedChannelSignal();
  private readonly templatesSignal = this.createTemplatesSignal();
  private readonly previewClientIdSignal = this.createPreviewClientIdSignal();
  private readonly selectedEmailVariantSignal = this.createSelectedEmailVariantSignal();
  private readonly selectedSmsVariantSignal = this.createSelectedSmsVariantSignal();
  private readonly selectedSegmentRuleSignal = this.createSelectedSegmentRuleSignal();
  private readonly overridesSignal = this.createOverridesSignal();
  private readonly confirmationPayloadSignal = this.createConfirmationPayloadSignal();
  private readonly confirmationOpenSignal = this.createConfirmationOpenSignal();
  private readonly statusBannerSignal = this.createStatusBannerSignal();

  readonly loadState: Signal<BroadcastLoadState> = this.loadStateSignal.asReadonly();
  readonly allRecipients: Signal<ClientSummary[]> = this.clientsSignal.asReadonly();
  readonly manualRecipients: Signal<ClientSummary[]> = computed(() => {
    const clientsById = new Map(this.clientsSignal().map((client) => [client.clientId, client]));
    return this.manualRecipientIdsSignal()
      .map((clientId) => clientsById.get(clientId))
      .filter((client): client is ClientSummary => Boolean(client));
  });
  readonly selectedChannel: Signal<BroadcastChannel> = this.selectedChannelSignal.asReadonly();
  readonly mergeFields: Signal<BroadcastMergeField[]> = signal(mergeFields).asReadonly();
  readonly emailVariants: Signal<BroadcastLayerOption[]> = signal(channelEmailVariants).asReadonly();
  readonly smsVariants: Signal<BroadcastLayerOption[]> = signal(channelSmsVariants).asReadonly();
  readonly segmentRules: Signal<BroadcastLayerOption[]> = signal(segmentRules).asReadonly();
  readonly confirmationPayload: Signal<BroadcastConfirmationPayload | null> =
    this.confirmationPayloadSignal.asReadonly();
  readonly confirmationOpen: Signal<boolean> = this.confirmationOpenSignal.asReadonly();
  readonly statusBanner: Signal<string | null> = this.statusBannerSignal.asReadonly();
  /* c8 ignore next */
  readonly filteredRecipients: Signal<ClientSummary[]> = computed(() =>
    this.applyFilters(this.clientsSignal(), this.filtersSignal()),
  );
  readonly selectedRecipients: Signal<ClientSummary[]> = computed(() => {
    const merged = new Map<string, ClientSummary>();
    for (const recipient of this.filteredRecipients()) {
      merged.set(recipient.clientId, recipient);
    }
    for (const recipient of this.manualRecipients()) {
      merged.set(recipient.clientId, recipient);
    }
    return Array.from(merged.values());
  });
  /* c8 ignore next */
  readonly counts: Signal<BroadcastRecipientCounts> = computed(() =>
    this.computeCounts(this.selectedRecipients()),
  );
  /* c8 ignore next */
  readonly exclusionSummary: Signal<BroadcastExclusionSummary> = computed(() =>
    this.computeExclusions(this.selectedRecipients(), this.counts(), this.selectedChannelSignal()),
  );
  /* c8 ignore next */
  readonly channelValidationMessage: Signal<string | null> = computed(() =>
    this.computeChannelValidation(this.counts(), this.selectedChannelSignal()),
  );
  /* c8 ignore next */
  readonly canDispatch: Signal<boolean> = computed(() => this.channelValidationMessage() === null);
  readonly previewRecipients: Signal<ClientSummary[]> = computed(() =>
    this.computePreviewRecipients(this.selectedRecipients(), this.selectedChannelSignal()),
  );
  readonly templates: Signal<BroadcastTemplates> = this.templatesSignal.asReadonly();
  /* c8 ignore next */
  readonly previewPayload: Signal<BroadcastPreviewPayload> = computed(() =>
      this.buildPreviewPayload(
      this.selectedRecipients(),
      this.previewClientIdSignal(),
      this.templatesSignal(),
      this.selectedEmailVariantSignal(),
      this.selectedSmsVariantSignal(),
      this.selectedSegmentRuleSignal(),
      this.overridesSignal(),
    ),
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
      .subscribe((channel) => {
        this.selectedChannelSignal.set(channel);
        this.syncPreviewSelection();
      });
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
    this.emailVariantControl.valueChanges
      .pipe(startWith(this.emailVariantControl.value), distinctUntilChanged())
      .subscribe((variant) => this.selectedEmailVariantSignal.set(variant));
    this.smsVariantControl.valueChanges
      .pipe(startWith(this.smsVariantControl.value), distinctUntilChanged())
      .subscribe((variant) => this.selectedSmsVariantSignal.set(variant));
    this.segmentRuleControl.valueChanges
      .pipe(startWith(this.segmentRuleControl.value), distinctUntilChanged())
      .subscribe((rule) => this.selectedSegmentRuleSignal.set(rule));
    this.previewClientIdControl.valueChanges
      .pipe(startWith(this.previewClientIdControl.value), distinctUntilChanged())
      .subscribe((previewClientId) => {
        this.previewClientIdSignal.set(previewClientId);
        this.syncOverrideEditors(previewClientId);
      });
    this.scheduleModeControl.valueChanges
      .pipe(startWith(this.scheduleModeControl.value), distinctUntilChanged())
      .subscribe((mode) => {
        if (mode === 'now') {
          this.scheduleAtControl.setValue('', { emitEvent: false });
        }
      });
  }

  async loadRecipients(): Promise<void> {
    this.loadStateSignal.set('loading');
    try {
      this.clientsSignal.set(await this.repository.listClients());
      this.pruneManualRecipientIds();
      this.syncPreviewSelection();
      this.loadStateSignal.set('ready');
    } catch (error) {
      console.warn('Failed to load broadcast recipients', error);
      this.clientsSignal.set([]);
      this.loadStateSignal.set('error');
    }
  }

  addManualRecipient(clientId: string): ManualRecipientAddResult {
    const normalizedId = clientId.trim();
    if (!normalizedId || !this.clientsSignal().some((client) => client.clientId === normalizedId)) {
      return 'not-found';
    }
    const alreadySelected =
      this.manualRecipientIdsSignal().includes(normalizedId) ||
      this.filteredRecipients().some((client) => client.clientId === normalizedId);
    if (alreadySelected) {
      return 'already-selected';
    }
    this.manualRecipientIdsSignal.update((current) => [...current, normalizedId]);
    this.syncPreviewSelection();
    return 'added';
  }

  removeManualRecipient(clientId: string): void {
    const normalizedId = clientId.trim();
    const before = this.manualRecipientIdsSignal().length;
    this.manualRecipientIdsSignal.update((current) =>
      current.filter((recipientId) => recipientId !== normalizedId),
    );
    if (before !== this.manualRecipientIdsSignal().length) {
      this.syncPreviewSelection();
    }
  }

  filteredRecipientsSnapshot(): ClientSummary[] {
    return this.filteredRecipients();
  }

  selectedRecipientsSnapshot(): ClientSummary[] {
    return this.selectedRecipients();
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

  saveOverrideForPreviewClient(): void {
    const previewClientId = this.previewClientIdSignal();
    if (!previewClientId) {
      return;
    }
    const override: BroadcastTemplateLayer = {};
    if (this.overrideSubjectControl.value.trim()) {
      override.emailSubject = this.overrideSubjectControl.value.trim();
    }
    if (this.overrideEmailBodyControl.value.trim()) {
      override.emailBody = this.overrideEmailBodyControl.value.trim();
    }
    if (this.overrideSmsBodyControl.value.trim()) {
      override.smsBody = this.overrideSmsBodyControl.value.trim();
    }
    if (Object.keys(override).length === 0) {
      this.clearOverrideForPreviewClient();
      return;
    }
    this.overridesSignal.update((current) => ({ ...current, [previewClientId]: override }));
  }

  clearOverrideForPreviewClient(): void {
    const previewClientId = this.previewClientIdSignal();
    if (!previewClientId) {
      return;
    }
    this.overridesSignal.update((current) => {
      const next = { ...current };
      delete next[previewClientId];
      return next;
    });
    this.syncOverrideEditors(previewClientId);
  }

  openDispatchConfirmation(): void {
    if (!this.canDispatch()) {
      return;
    }
    this.confirmationPayloadSignal.set({
      mode: 'dispatch',
      channel: this.selectedChannel(),
      recipients: this.selectedRecipients().length,
      scheduledAtLabel: this.resolveScheduledLabel(),
    });
    this.statusBannerSignal.set(null);
    this.confirmationOpenSignal.set(true);
  }

  openTestConfirmation(): void {
    if (!this.canDispatch() || !this.hasTestDestination()) {
      return;
    }
    this.confirmationPayloadSignal.set({
      mode: 'test',
      channel: this.selectedChannel(),
      recipients: 1,
      scheduledAtLabel: this.resolveScheduledLabel(),
    });
    this.statusBannerSignal.set(null);
    this.confirmationOpenSignal.set(true);
  }

  closeConfirmation(): void {
    this.confirmationOpenSignal.set(false);
    this.confirmationPayloadSignal.set(null);
  }

  async confirmCurrentAction(): Promise<void> {
    const payload = this.confirmationPayloadSignal();
    if (!payload) {
      return;
    }
    this.closeConfirmation();

    try {
      if (payload.mode === 'test') {
        const request = this.buildTestRequest();
        const result = await this.delivery.sendTest(request);
        this.statusBannerSignal.set(
          `Test message ${result.status === 'scheduled' ? 'scheduled' : 'queued'} for ${this.resolveTestDestinationLabel()} (${payload.channel}).`,
        );
        return;
      }

      const request = this.buildDispatchRequest();
      const result = await this.delivery.dispatch(request);
      const state = result.status === 'scheduled' ? 'scheduled' : 'queued';
      this.statusBannerSignal.set(
        `Broadcast ${state} for ${result.stats.recipients} recipients (${payload.channel}).`,
      );
    } catch (error) {
      console.warn('Failed to execute broadcast action', error);
      this.statusBannerSignal.set(
        'Broadcast action failed. Check provider configuration and retry.',
      );
    }
  }

  private updateFilters(partial: Partial<BroadcastFilters>): void {
    this.filtersSignal.update((current) => ({ ...current, ...partial }));
    this.syncPreviewSelection();
  }

  private updateTemplates(partial: Partial<BroadcastTemplates>): void {
    this.templatesSignal.update((current) => ({ ...current, ...partial }));
  }

  private syncOverrideEditors(previewClientId: string): void {
    const override = this.overridesSignal()[previewClientId];
    this.overrideSubjectControl.setValue(override?.emailSubject ?? '', { emitEvent: false });
    this.overrideEmailBodyControl.setValue(override?.emailBody ?? '', { emitEvent: false });
    this.overrideSmsBodyControl.setValue(override?.smsBody ?? '', { emitEvent: false });
  }

  private hasTestDestination(): boolean {
    const channel = this.selectedChannel();
    const hasEmailDestination = this.testEmailControl.value.trim().length > 0;
    const hasPhoneDestination = digitsOnly(this.testPhoneControl.value).length >= 10;
    if (channel === 'email') {
      return hasEmailDestination;
    }
    if (channel === 'sms') {
      return hasPhoneDestination;
    }
    return hasEmailDestination && hasPhoneDestination;
  }

  private resolveScheduledLabel(): string {
    if (this.scheduleModeControl.value === 'now') {
      return 'Send now';
    }
    if (!this.scheduleAtControl.value.trim()) {
      return 'Scheduled time missing';
    }
    return this.scheduleAtControl.value.trim();
  }

  private resolveTestDestinationLabel(): string {
    const channel = this.selectedChannel();
    if (channel === 'email') {
      return this.testEmailControl.value.trim();
    }
    if (channel === 'sms') {
      return this.testPhoneControl.value.trim();
    }
    return `${this.testEmailControl.value.trim()} + ${this.testPhoneControl.value.trim()}`;
  }

  private buildTestRequest(): BroadcastTestRequest {
    const preview = this.previewPayload();
    const request: BroadcastTestRequest = {
      channel: this.selectedChannel(),
      scheduleMode: this.scheduleModeControl.value,
      scheduleAt: this.scheduleAtControl.value.trim() || undefined,
    };

    if (request.channel === 'email' || request.channel === 'both') {
      request.email = {
        to: this.testEmailControl.value.trim(),
        subject: preview.emailSubject,
        body: preview.emailBody,
      };
    }
    if (request.channel === 'sms' || request.channel === 'both') {
      request.sms = {
        to: this.testPhoneControl.value.trim(),
        body: preview.smsBody,
      };
    }
    return request;
  }

  private buildDispatchRequest(): BroadcastDispatchRequest {
    return {
      channel: this.selectedChannel(),
      scheduleMode: this.scheduleModeControl.value,
      scheduleAt: this.scheduleAtControl.value.trim() || undefined,
      recipients: this.buildDispatchRecipients(),
    };
  }

  private buildDispatchRecipients(): BroadcastDispatchRecipient[] {
    const clients = this.selectedRecipients();
    const templates = this.templatesSignal();
    const emailVariant = this.selectedEmailVariantSignal();
    const smsVariant = this.selectedSmsVariantSignal();
    const segmentRule = this.selectedSegmentRuleSignal();
    const overrides = this.overridesSignal();

    return clients.map((client) => {
      const layered = this.buildLayeredTemplates(
        templates,
        client,
        emailVariant,
        smsVariant,
        segmentRule,
        overrides,
      );

      return {
        clientId: client.clientId,
        clientLabel: client.fullName,
        email: client.email?.trim() || undefined,
        phone: hasSmsPhone(client) ? client.phone : undefined,
        emailSubject: this.applyMergeFields(layered.templates.emailSubject, client),
        emailBody: this.applyMergeFields(layered.templates.emailBody, client),
        smsBody: this.applyMergeFields(layered.templates.smsBody, client),
      };
    });
  }

  private syncPreviewSelection(): void {
    const filteredRecipients = this.previewRecipients();
    const currentPreviewId = this.previewClientIdSignal();
    if (filteredRecipients.length === 0) {
      this.previewClientIdSignal.set('');
      this.previewClientIdControl.setValue('', { emitEvent: false });
      this.syncOverrideEditors('');
      return;
    }
    if (currentPreviewId && filteredRecipients.some((client) => client.clientId === currentPreviewId)) {
      this.syncOverrideEditors(currentPreviewId);
      return;
    }
    const nextId = filteredRecipients[0].clientId;
    this.previewClientIdSignal.set(nextId);
    this.previewClientIdControl.setValue(nextId, { emitEvent: false });
    this.syncOverrideEditors(nextId);
  }

  private buildPreviewPayload(
    filteredRecipients: ClientSummary[],
    previewClientId: string,
    templates: BroadcastTemplates,
    selectedEmailVariant: string,
    selectedSmsVariant: string,
    selectedSegmentRule: string,
    overrides: Record<string, BroadcastTemplateLayer>,
  ): BroadcastPreviewPayload {
    const selectedClient =
      filteredRecipients.find((client) => client.clientId === previewClientId) ?? null;
    const layered = this.buildLayeredTemplates(
      templates,
      selectedClient,
      selectedEmailVariant,
      selectedSmsVariant,
      selectedSegmentRule,
      overrides,
    );
    return {
      clientId: selectedClient?.clientId ?? null,
      clientLabel: selectedClient?.fullName ?? 'No recipient selected',
      emailSubject: this.applyMergeFields(layered.templates.emailSubject, selectedClient),
      emailBody: this.applyMergeFields(layered.templates.emailBody, selectedClient),
      smsBody: this.applyMergeFields(layered.templates.smsBody, selectedClient),
      activeLayers: layered.activeLayers,
    };
  }

  private buildLayeredTemplates(
    templates: BroadcastTemplates,
    client: ClientSummary | null,
    selectedEmailVariant: string,
    selectedSmsVariant: string,
    selectedSegmentRule: string,
    overrides: Record<string, BroadcastTemplateLayer>,
  ): { templates: BroadcastTemplates; activeLayers: string[] } {
    const activeLayers = ['Base template'];
    const layered: BroadcastTemplates = { ...templates };
    const emailVariant = channelEmailVariants.find((variant) => variant.id === selectedEmailVariant);
    if (emailVariant && emailVariant.id !== 'default') {
      layered.emailSubject = emailVariant.layer.emailSubject ?? layered.emailSubject;
      layered.emailBody = emailVariant.layer.emailBody ?? layered.emailBody;
      activeLayers.push(`Email variant: ${emailVariant.label}`);
    }

    const smsVariant = channelSmsVariants.find((variant) => variant.id === selectedSmsVariant);
    if (smsVariant && smsVariant.id !== 'default') {
      layered.smsBody = smsVariant.layer.smsBody ?? layered.smsBody;
      activeLayers.push(`SMS variant: ${smsVariant.label}`);
    }

    const segmentRule = segmentRules.find((rule) => rule.id === selectedSegmentRule);
    if (segmentRule && segmentRule.id !== 'none' && client && segmentRule.matches(client)) {
      layered.emailSubject = segmentRule.layer.emailSubject ?? layered.emailSubject;
      layered.emailBody = segmentRule.layer.emailBody ?? layered.emailBody;
      layered.smsBody = segmentRule.layer.smsBody ?? layered.smsBody;
      activeLayers.push(`Segment rule: ${segmentRule.label}`);
    }

    const override = client ? overrides[client.clientId] : undefined;
    if (override) {
      layered.emailSubject = override.emailSubject ?? layered.emailSubject;
      layered.emailBody = override.emailBody ?? layered.emailBody;
      layered.smsBody = override.smsBody ?? layered.smsBody;
      activeLayers.push(`Client override: ${client?.fullName}`);
    }

    return { templates: layered, activeLayers };
  }

  private applyMergeFields(template: string, client: ClientSummary | null): string {
    const map = this.buildMergeMap(client);
    return mergeFields.reduce(
      (output, field) =>
        output
          .replaceAll(field.token, map[field.key])
          .replaceAll(mergeFieldEditorToken(field), map[field.key]),
      template,
    );
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
    if (target === 'internalNote') {
      return this.internalNoteControl;
    }
    if (target === 'overrideSubject') {
      return this.overrideSubjectControl;
    }
    if (target === 'overrideEmailBody') {
      return this.overrideEmailBodyControl;
    }
    if (target === 'overrideSmsBody') {
      return this.overrideSmsBodyControl;
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

  private pruneManualRecipientIds(): void {
    const rosterIds = new Set(this.clientsSignal().map((client) => client.clientId));
    this.manualRecipientIdsSignal.update((current) =>
      current.filter((recipientId) => rosterIds.has(recipientId)),
    );
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

  private computePreviewRecipients(
    filteredRecipients: ClientSummary[],
    channel: BroadcastChannel,
  ): ClientSummary[] {
    if (channel === 'email') {
      return filteredRecipients.filter((client) => hasEmail(client));
    }
    if (channel === 'sms') {
      return filteredRecipients.filter((client) => hasSmsPhone(client));
    }
    return filteredRecipients.filter((client) => hasEmail(client) && hasSmsPhone(client));
  }

  private createClientsSignal(): WritableSignal<ClientSummary[]> {
    return signal<ClientSummary[]>([]);
  }

  private createManualRecipientIdsSignal(): WritableSignal<string[]> {
    return signal<string[]>([]);
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

  private createSelectedEmailVariantSignal(): WritableSignal<string> {
    return signal('default');
  }

  private createSelectedSmsVariantSignal(): WritableSignal<string> {
    return signal('default');
  }

  private createSelectedSegmentRuleSignal(): WritableSignal<string> {
    return signal('none');
  }

  private createOverridesSignal(): WritableSignal<Record<string, BroadcastTemplateLayer>> {
    return signal<Record<string, BroadcastTemplateLayer>>({});
  }

  private createConfirmationPayloadSignal(): WritableSignal<BroadcastConfirmationPayload | null> {
    return signal<BroadcastConfirmationPayload | null>(null);
  }

  private createConfirmationOpenSignal(): WritableSignal<boolean> {
    return signal(false);
  }

  private createStatusBannerSignal(): WritableSignal<string | null> {
    return signal<string | null>(null);
  }
}


