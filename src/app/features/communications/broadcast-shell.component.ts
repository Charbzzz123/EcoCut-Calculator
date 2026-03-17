import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { ClientSummary } from '@shared/domain/entry/entry-repository.service.js';
import { BackChipComponent } from '@shared/ui/back-chip/back-chip.component.js';
import { BrandBannerComponent } from '@shared/ui/brand-banner/brand-banner.component.js';
import { BroadcastFacade } from './broadcast.facade.js';
import type {
  BroadcastChannel,
  BroadcastCostEstimate,
  BroadcastTemplateTarget,
} from './broadcast.types.js';

const EMAIL_ESTIMATE_COST = 0;
const SMS_ESTIMATE_COST = 0.02;
const MIN_DAILY_CAP = 1;
const MAX_DAILY_CAP = 5000;

interface AudiencePreviewRow {
  client: ClientSummary;
  channelLabel: string;
  channelClass: 'both' | 'email' | 'sms' | 'none';
}

@Component({
  standalone: true,
  selector: 'app-broadcast-shell',
  templateUrl: './broadcast-shell.component.html',
  styleUrl: './broadcast-shell.component.scss',
  imports: [CommonModule, ReactiveFormsModule, BrandBannerComponent, BackChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BroadcastShellComponent implements OnInit {
  private readonly facade = inject(BroadcastFacade);
  private confirmedChannel: BroadcastChannel | null = null;
  private readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  protected readonly headingId = 'broadcast-heading';
  protected readonly emailCap = signal(80);
  protected readonly smsCap = signal(200);
  protected readonly capEditorOpen = signal(false);
  protected readonly capConfirmationOpen = signal(false);
  protected readonly capEditorNotice = signal<string | null>(null);
  protected readonly emailCapDraftControl = new FormControl(80, { nonNullable: true });
  protected readonly smsCapDraftControl = new FormControl(200, { nonNullable: true });
  protected readonly queryControl = this.facade.queryControl;
  protected readonly requireEmailControl = this.facade.requireEmailControl;
  protected readonly requirePhoneControl = this.facade.requirePhoneControl;
  protected readonly serviceWindowControl = this.facade.serviceWindowControl;
  protected readonly upcomingWindowControl = this.facade.upcomingWindowControl;
  protected readonly channelControl = this.facade.channelControl;
  protected readonly loadState = this.facade.loadState;
  protected readonly counts = this.facade.counts;
  protected readonly exclusions = this.facade.exclusionSummary;
  protected readonly channelValidationMessage = this.facade.channelValidationMessage;
  protected readonly canDispatch = this.facade.canDispatch;
  protected readonly filteredRecipients = this.facade.filteredRecipients;
  protected readonly mergeFields = this.facade.mergeFields;
  protected readonly emailSubjectControl = this.facade.emailSubjectControl;
  protected readonly emailBodyControl = this.facade.emailBodyControl;
  protected readonly smsBodyControl = this.facade.smsBodyControl;
  protected readonly ctaLinkControl = this.facade.ctaLinkControl;
  protected readonly internalNoteControl = this.facade.internalNoteControl;
  protected readonly previewClientIdControl = this.facade.previewClientIdControl;
  protected readonly emailVariantControl = this.facade.emailVariantControl;
  protected readonly smsVariantControl = this.facade.smsVariantControl;
  protected readonly segmentRuleControl = this.facade.segmentRuleControl;
  protected readonly overrideSubjectControl = this.facade.overrideSubjectControl;
  protected readonly overrideEmailBodyControl = this.facade.overrideEmailBodyControl;
  protected readonly overrideSmsBodyControl = this.facade.overrideSmsBodyControl;
  protected readonly emailVariants = this.facade.emailVariants;
  protected readonly smsVariants = this.facade.smsVariants;
  protected readonly segmentRules = this.facade.segmentRules;
  protected readonly previewPayload = this.facade.previewPayload;
  protected readonly smsMetrics = this.facade.smsMetrics;
  protected readonly scheduleModeControl = this.facade.scheduleModeControl;
  protected readonly scheduleAtControl = this.facade.scheduleAtControl;
  protected readonly testEmailControl = this.facade.testEmailControl;
  protected readonly testPhoneControl = this.facade.testPhoneControl;
  protected readonly confirmationOpen = this.facade.confirmationOpen;
  protected readonly confirmationPayload = this.facade.confirmationPayload;
  protected readonly statusBanner = this.facade.statusBanner;
  /* c8 ignore next */
  protected readonly audiencePreviewRows = computed<AudiencePreviewRow[]>(() =>
    this.filteredRecipients().map((client) => {
      const hasEmail =
        typeof client.email === 'string' && client.email.trim().length > 0;
      const hasPhone = this.isSmsCapable(client.phone);
      if (hasEmail && hasPhone) {
        return { client, channelLabel: 'Email + SMS', channelClass: 'both' as const };
      }
      if (hasEmail) {
        return { client, channelLabel: 'Email only', channelClass: 'email' as const };
      }
      if (hasPhone) {
        return { client, channelLabel: 'SMS only', channelClass: 'sms' as const };
      }
      return { client, channelLabel: 'Missing channel', channelClass: 'none' as const };
    }),
  );
  protected costEstimate(): BroadcastCostEstimate {
    const counts = this.counts();
    const channel = this.channelControl.value;
    const smsSegmentsPerRecipient = Math.max(this.smsMetrics().segments, 1);

    const emailRecipients =
      channel === 'email'
        ? counts.emailEligible
        : channel === 'both'
          ? counts.bothEligible
          : 0;

    const smsRecipients =
      channel === 'sms'
        ? counts.smsEligible
        : channel === 'both'
          ? counts.bothEligible
          : 0;

    const smsSegmentsTotal = smsRecipients * smsSegmentsPerRecipient;
    const emailEstimatedCost = emailRecipients * EMAIL_ESTIMATE_COST;
    const smsEstimatedCost = smsSegmentsTotal * SMS_ESTIMATE_COST;
    const totalEstimatedCost = emailEstimatedCost + smsEstimatedCost;

    return {
      emailRecipients,
      smsRecipients,
      smsSegmentsPerRecipient,
      smsSegmentsTotal,
      emailUnitCost: EMAIL_ESTIMATE_COST,
      smsUnitCost: SMS_ESTIMATE_COST,
      emailEstimatedCost,
      smsEstimatedCost,
      totalEstimatedCost,
    };
  }
  ngOnInit(): void {
    void this.facade.loadRecipients();
  }

  protected reloadRecipients(): void {
    void this.facade.loadRecipients();
  }

  protected openCapEditor(): void {
    this.emailCapDraftControl.setValue(this.emailCap());
    this.smsCapDraftControl.setValue(this.smsCap());
    this.capEditorNotice.set(null);
    this.capConfirmationOpen.set(false);
    this.capEditorOpen.set(true);
  }

  protected cancelCapEditor(): void {
    this.capEditorNotice.set(null);
    this.capConfirmationOpen.set(false);
    this.capEditorOpen.set(false);
  }

  protected requestCapConfirmation(): void {
    const emailCap = this.normalizeCapValue(this.emailCapDraftControl.value);
    const smsCap = this.normalizeCapValue(this.smsCapDraftControl.value);
    if (!this.isCapValueValid(emailCap) || !this.isCapValueValid(smsCap)) {
      this.capEditorNotice.set(
        `Caps must be whole numbers between ${MIN_DAILY_CAP} and ${MAX_DAILY_CAP}.`,
      );
      this.capConfirmationOpen.set(false);
      return;
    }
    this.capEditorNotice.set(null);
    this.capConfirmationOpen.set(true);
  }

  protected applyCapChanges(): void {
    const emailCap = this.normalizeCapValue(this.emailCapDraftControl.value);
    const smsCap = this.normalizeCapValue(this.smsCapDraftControl.value);
    if (!this.isCapValueValid(emailCap) || !this.isCapValueValid(smsCap)) {
      this.capEditorNotice.set(
        `Caps must be whole numbers between ${MIN_DAILY_CAP} and ${MAX_DAILY_CAP}.`,
      );
      this.capConfirmationOpen.set(false);
      return;
    }
    this.emailCap.set(emailCap);
    this.smsCap.set(smsCap);
    this.capEditorNotice.set('Daily caps updated.');
    this.capConfirmationOpen.set(false);
    this.capEditorOpen.set(false);
  }

  protected capEditSummary(): string {
    return `Email ${this.emailCap()} -> ${this.normalizeCapValue(this.emailCapDraftControl.value)} | SMS ${this.smsCap()} -> ${this.normalizeCapValue(this.smsCapDraftControl.value)}`;
  }

  protected confirmSelectedChannel(): void {
    this.confirmedChannel = this.channelControl.value;
  }

  protected channelSelectionStatus(): { confirmed: boolean; message: string } {
    const selectedChannel = this.channelControl.value;
    if (this.confirmedChannel === selectedChannel) {
      return {
        confirmed: true,
        message: `Channel confirmed: ${this.channelLabel(selectedChannel)}.`,
      };
    }
    if (this.confirmedChannel === null) {
      return {
        confirmed: false,
        message: `Current channel: ${this.channelLabel(selectedChannel)}. Click confirm to lock your choice.`,
      };
    }
    return {
      confirmed: false,
      message: `Channel changed to ${this.channelLabel(selectedChannel)}. Confirm again before moving on.`,
    };
  }

  protected insertMergeField(target: BroadcastTemplateTarget, token: string): void {
    this.facade.insertMergeField(target, token);
  }

  protected saveOverrideForPreviewClient(): void {
    this.facade.saveOverrideForPreviewClient();
  }

  protected clearOverrideForPreviewClient(): void {
    this.facade.clearOverrideForPreviewClient();
  }

  protected openTestConfirmation(): void {
    this.facade.openTestConfirmation();
  }

  protected openDispatchConfirmation(): void {
    this.facade.openDispatchConfirmation();
  }

  protected closeConfirmation(): void {
    this.facade.closeConfirmation();
  }

  protected onConfirmationBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeConfirmation();
    }
  }

  protected confirmCurrentAction(): void {
    void this.facade.confirmCurrentAction();
  }

  protected movePreview(offset: -1 | 1): void {
    const recipients = this.filteredRecipients();
    if (recipients.length <= 1) {
      return;
    }
    const currentId = this.previewClientIdControl.value;
    const currentIndex = recipients.findIndex((client) => client.clientId === currentId);
    const safeIndex = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex = safeIndex + offset;
    if (nextIndex < 0 || nextIndex >= recipients.length) {
      return;
    }
    this.previewClientIdControl.setValue(recipients[nextIndex].clientId);
  }

  protected dispatchBlockedReason(): string | null {
    if (this.channelValidationMessage()) {
      return this.channelValidationMessage();
    }
    if (!this.isChannelConfirmed()) {
      return 'Confirm the channel selection in Step 2 before sending.';
    }
    if (!this.isMessageReadyForChannel()) {
      return 'Add all required subject/body fields for the selected channel.';
    }
    if (this.scheduleModeControl.value === 'later' && !this.hasScheduledTimestamp()) {
      return 'Pick a scheduled timestamp before confirming broadcast.';
    }
    return null;
  }

  protected testBlockedReason(): string | null {
    const dispatchReason = this.dispatchBlockedReason();
    if (dispatchReason) {
      return dispatchReason;
    }
    const channel = this.channelControl.value;
    const hasEmailDestination = this.isValidEmailDestination(this.testEmailControl.value);
    const hasPhoneDestination = this.isValidSmsDestination(this.testPhoneControl.value);
    if (channel === 'email' && !hasEmailDestination) {
      return 'If you want to send a test, enter a valid test email destination.';
    }
    if (channel === 'sms' && !hasPhoneDestination) {
      return 'If you want to send a test, enter a valid test SMS destination.';
    }
    if (channel === 'both' && (!hasEmailDestination || !hasPhoneDestination)) {
      return 'If you want to send a test, enter valid test email and test SMS destinations.';
    }
    return null;
  }

  protected visibleTestBlockedReason(): string | null {
    const testReason = this.testBlockedReason();
    if (!testReason) {
      return null;
    }
    const dispatchReason = this.dispatchBlockedReason();
    if (dispatchReason && dispatchReason === testReason) {
      return null;
    }
    return testReason;
  }

  private hasScheduledTimestamp(): boolean {
    return this.scheduleAtControl.value.trim().length > 0;
  }

  private isMessageReadyForChannel(): boolean {
    const channel = this.channelControl.value;
    const emailReady =
      this.emailSubjectControl.value.trim().length > 0 && this.emailBodyControl.value.trim().length > 0;
    const smsReady = this.smsBodyControl.value.trim().length > 0;
    if (channel === 'email') {
      return emailReady;
    }
    if (channel === 'sms') {
      return smsReady;
    }
    return emailReady && smsReady;
  }

  private isSmsCapable(value: string | null | undefined): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    return value.replace(/\D/g, '').length >= 10;
  }

  private isValidEmailDestination(value: string): boolean {
    return this.emailPattern.test(value.trim().toLowerCase());
  }

  private isValidSmsDestination(value: string): boolean {
    return this.extractSmsDigits(value).length === 10;
  }

  private formatPhoneForInput(value: string): string {
    const digits = this.extractSmsDigits(value);
    const area = digits.slice(0, 3);
    const prefix = digits.slice(3, 6);
    const line = digits.slice(6, 10);

    if (digits.length <= 3) {
      return area;
    }
    if (digits.length <= 6) {
      return `(${area}) ${prefix}`;
    }
    return `(${area}) ${prefix}-${line}`;
  }

  private extractSmsDigits(value: string): string {
    const rawDigits = value.replace(/\D/g, '');
    const withoutCountryCode =
      rawDigits.length > 10 && rawDigits.startsWith('1') ? rawDigits.slice(1) : rawDigits;
    return withoutCountryCode.slice(0, 10);
  }

  private normalizeCapValue(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.trunc(value);
  }

  private isCapValueValid(value: number): boolean {
    return value >= MIN_DAILY_CAP && value <= MAX_DAILY_CAP;
  }

  protected canConfirmDispatch(): boolean {
    return this.dispatchBlockedReason() === null;
  }

  protected canSendTest(): boolean {
    return this.testBlockedReason() === null;
  }

  protected readinessChecklist(): { label: string; isReady: boolean }[] {
    const recipientsReady = this.counts().total > 0;
    const channelReady = this.channelValidationMessage() === null;
    const channelConfirmed = this.isChannelConfirmed();
    const messageReady = this.isMessageReadyForChannel();
    const scheduleReady = this.scheduleModeControl.value === 'now' || this.hasScheduledTimestamp();
    return [
      { label: 'Recipients selected', isReady: recipientsReady },
      { label: 'Channel eligibility', isReady: channelReady },
      { label: 'Channel confirmation', isReady: channelConfirmed },
      { label: 'Message content', isReady: messageReady },
      { label: 'Schedule', isReady: scheduleReady },
    ];
  }

  protected canGoToPreviousPreview(): boolean {
    return this.canMovePreview(-1);
  }

  protected canGoToNextPreview(): boolean {
    return this.canMovePreview(1);
  }

  protected onTestEmailInput(): void {
    const normalized = this.testEmailControl.value.trim().toLowerCase();
    if (normalized !== this.testEmailControl.value) {
      this.testEmailControl.setValue(normalized, { emitEvent: false });
    }
  }

  protected onTestPhoneInput(): void {
    const normalized = this.formatPhoneForInput(this.testPhoneControl.value);
    if (normalized !== this.testPhoneControl.value) {
      this.testPhoneControl.setValue(normalized, { emitEvent: false });
    }
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private canMovePreview(offset: -1 | 1): boolean {
    const recipients = this.filteredRecipients();
    if (recipients.length <= 1) {
      return false;
    }
    const currentId = this.previewClientIdControl.value;
    const currentIndex = recipients.findIndex((client) => client.clientId === currentId);
    const safeIndex = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex = safeIndex + offset;
    return nextIndex >= 0 && nextIndex < recipients.length;
  }

  private isChannelConfirmed(): boolean {
    return this.confirmedChannel === this.channelControl.value;
  }

  private channelLabel(channel: BroadcastChannel): string {
    if (channel === 'email') {
      return 'Email';
    }
    if (channel === 'sms') {
      return 'SMS';
    }
    return 'Email + SMS';
  }
}
