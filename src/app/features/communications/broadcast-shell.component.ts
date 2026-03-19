import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { ClientSummary } from '@shared/domain/entry/entry-repository.service.js';
import { BackChipComponent } from '@shared/ui/back-chip/back-chip.component.js';
import { BrandBannerComponent } from '@shared/ui/brand-banner/brand-banner.component.js';
import { MergeTokenEditorComponent } from '@shared/ui/merge-token-editor/merge-token-editor.component.js';
import {
  SelectDropdownComponent,
  type SelectDropdownOption,
} from '@shared/ui/select-dropdown/select-dropdown.component.js';
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

interface ChannelSummaryRow {
  label: string;
  value: number;
}

interface ManualPickerRow {
  client: ClientSummary;
  isInFilters: boolean;
  isAddedManually: boolean;
  isQueued: boolean;
  canQueue: boolean;
}

@Component({
  standalone: true,
  selector: 'app-broadcast-shell',
  templateUrl: './broadcast-shell.component.html',
  styleUrl: './broadcast-shell.component.scss',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BrandBannerComponent,
    BackChipComponent,
    MergeTokenEditorComponent,
    SelectDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BroadcastShellComponent implements OnInit {
  private readonly facade = inject(BroadcastFacade);
  private confirmedChannel: BroadcastChannel | null = null;
  private readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  protected readonly headingId = 'broadcast-heading';
  protected readonly emailCap = signal(80);
  protected readonly smsCap = signal(200);
  protected readonly overridePanelOpen = signal(false);
  protected readonly capEditorOpen = signal(false);
  protected readonly capConfirmationOpen = signal(false);
  protected readonly capEditorNotice = signal<string | null>(null);
  protected readonly manualPanelOpen = signal(false);
  protected readonly manualRecipientNotice = signal<string | null>(null);
  protected readonly manualQueuedClientIds = signal<string[]>([]);
  protected readonly manualSearchQuery = signal('');
  protected readonly emailCapDraftControl = new FormControl(80, { nonNullable: true });
  protected readonly smsCapDraftControl = new FormControl(200, { nonNullable: true });
  protected readonly manualSearchControl = new FormControl('', { nonNullable: true });
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
  protected readonly allRecipients = this.facade.allRecipients;
  protected readonly filteredRecipients = this.facade.filteredRecipients;
  protected readonly manualRecipients = this.facade.manualRecipients;
  protected readonly previewRecipients = this.facade.previewRecipients;
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
  protected readonly mergeDragTarget = signal<BroadcastTemplateTarget | null>(null);
  protected readonly serviceWindowOptions: SelectDropdownOption[] = [
    { value: 'any', label: 'Any' },
    { value: 'last-90', label: 'Last 90 days' },
    { value: 'last-365', label: 'Last 365 days' },
    { value: 'no-history', label: 'No service yet' },
  ];
  protected readonly upcomingWindowOptions: SelectDropdownOption[] = [
    { value: 'any', label: 'Any' },
    { value: 'next-30', label: 'Next 30 days' },
    { value: 'next-90', label: 'Next 90 days' },
    { value: 'no-upcoming', label: 'None scheduled' },
  ];
  protected readonly scheduleModeOptions: SelectDropdownOption[] = [
    { value: 'now', label: 'Send now' },
    { value: 'later', label: 'Schedule for later' },
  ];
  protected readonly segmentRuleOptions = computed<SelectDropdownOption[]>(() =>
    this.segmentRules().map((rule) => ({
      value: rule.id,
      label: rule.label,
    })),
  );
  protected readonly emailVariantOptions = computed<SelectDropdownOption[]>(() =>
    this.emailVariants().map((variant) => ({
      value: variant.id,
      label: variant.label,
    })),
  );
  protected readonly smsVariantOptions = computed<SelectDropdownOption[]>(() =>
    this.smsVariants().map((variant) => ({
      value: variant.id,
      label: variant.label,
    })),
  );
  protected readonly previewRecipientOptions = computed<SelectDropdownOption[]>(() =>
    this.previewRecipients().map((client) => ({
      value: client.clientId,
      label: client.fullName,
    })),
  );
  private lastTemplateTarget: BroadcastTemplateTarget = 'emailBody';
  private readonly cursorByTarget: Record<BroadcastTemplateTarget, { start: number; end: number }> = {
    emailSubject: { start: this.emailSubjectControl.value.length, end: this.emailSubjectControl.value.length },
    emailBody: { start: this.emailBodyControl.value.length, end: this.emailBodyControl.value.length },
    smsBody: { start: this.smsBodyControl.value.length, end: this.smsBodyControl.value.length },
    internalNote: { start: this.internalNoteControl.value.length, end: this.internalNoteControl.value.length },
    overrideSubject: {
      start: this.overrideSubjectControl.value.length,
      end: this.overrideSubjectControl.value.length,
    },
    overrideEmailBody: {
      start: this.overrideEmailBodyControl.value.length,
      end: this.overrideEmailBodyControl.value.length,
    },
    overrideSmsBody: {
      start: this.overrideSmsBodyControl.value.length,
      end: this.overrideSmsBodyControl.value.length,
    },
  };
  private readonly templateControlByTarget: Record<BroadcastTemplateTarget, FormControl<string>> = {
    emailSubject: this.emailSubjectControl,
    emailBody: this.emailBodyControl,
    smsBody: this.smsBodyControl,
    internalNote: this.internalNoteControl,
    overrideSubject: this.overrideSubjectControl,
    overrideEmailBody: this.overrideEmailBodyControl,
    overrideSmsBody: this.overrideSmsBodyControl,
  };
  @ViewChild('emailSubjectEditor') private emailSubjectEditor?: MergeTokenEditorComponent;
  @ViewChild('emailBodyEditor') private emailBodyEditor?: MergeTokenEditorComponent;
  @ViewChild('smsBodyEditor') private smsBodyEditor?: MergeTokenEditorComponent;
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

  protected channelSelectionStatus(): {
    confirmed: boolean;
    message: string;
    tone: 'ok' | 'info' | 'warning';
  } {
    const selectedChannel = this.channelControl.value;
    if (this.confirmedChannel === selectedChannel) {
      return {
        confirmed: true,
        message: `Channel confirmed: ${this.channelLabel(selectedChannel)}.`,
        tone: 'ok',
      };
    }
    if (this.confirmedChannel === null) {
      return {
        confirmed: false,
        message: `Current channel: ${this.channelLabel(selectedChannel)}. Click confirm to lock your choice.`,
        tone: 'info',
      };
    }
    return {
      confirmed: false,
      message: `Channel changed to ${this.channelLabel(selectedChannel)}. Confirm again before moving on.`,
      tone: 'warning',
    };
  }

  protected showChannelConfirmButton(): boolean {
    return !this.channelSelectionStatus().confirmed;
  }

  protected selectedChannelEligibleRecipients(): number {
    const counts = this.counts();
    const channel = this.channelControl.value;
    if (channel === 'email') {
      return counts.emailEligible;
    }
    if (channel === 'sms') {
      return counts.smsEligible;
    }
    return counts.bothEligible;
  }

  protected selectedRecipientsCount(): number {
    return this.counts().total;
  }

  protected recipientLabel(count: number): string {
    return count === 1 ? 'recipient' : 'recipients';
  }

  protected selectedChannelLabel(): string {
    return this.channelLabel(this.channelControl.value);
  }

  protected isEmailChannelActive(): boolean {
    return this.channelControl.value !== 'sms';
  }

  protected isSmsChannelActive(): boolean {
    return this.channelControl.value !== 'email';
  }

  protected channelSummaryRows(): ChannelSummaryRow[] {
    const summary = this.exclusions();
    const channel = this.channelControl.value;

    if (channel === 'email') {
      return [
        { label: 'Missing email', value: summary.missingEmail },
        { label: 'Excluded for selected channel', value: summary.excludedForSelectedChannel },
      ];
    }
    if (channel === 'sms') {
      return [
        { label: 'Missing phone', value: summary.missingPhone },
        { label: 'Excluded for selected channel', value: summary.excludedForSelectedChannel },
      ];
    }
    return [
      { label: 'Missing email', value: summary.missingEmail },
      { label: 'Missing phone', value: summary.missingPhone },
      { label: 'Missing both channels', value: summary.missingBoth },
      { label: 'Excluded for selected channel', value: summary.excludedForSelectedChannel },
    ];
  }

  protected channelEligibilityMessage(): string {
    const eligible = this.selectedChannelEligibleRecipients();
    const selected = this.selectedRecipientsCount();
    const channel = this.channelControl.value;
    if (channel === 'email') {
      return `Email is valid for ${eligible} email-eligible ${this.recipientLabel(eligible)} (${selected} selected).`;
    }
    if (channel === 'sms') {
      return `SMS is valid for ${eligible} SMS-eligible ${this.recipientLabel(eligible)} (${selected} selected).`;
    }
    return `Both channels are valid for ${eligible} dual-eligible ${this.recipientLabel(eligible)} (${selected} selected).`;
  }

  protected insertMergeField(token: string, explicitTarget?: BroadcastTemplateTarget): void {
    const target = explicitTarget ?? this.lastTemplateTarget;
    const editor = this.resolveTokenEditor(target);
    if (editor) {
      editor.insertToken(token, this.resolveMergeLabel(token));
      return;
    }
    const cursor = this.cursorByTarget[target];
    this.insertTokenAtTarget(target, token, cursor.start, cursor.end);
  }

  protected mergeFieldEditorToken(label: string): string {
    return `[[${label}]]`;
  }

  protected onTokenEditorFocus(target: BroadcastTemplateTarget): void {
    this.lastTemplateTarget = target;
  }

  protected onTokenEditorValueChange(target: BroadcastTemplateTarget, value: string): void {
    this.templateControlByTarget[target].setValue(value);
  }

  protected onTemplateCursorChange(
    event: Event,
    target: BroadcastTemplateTarget,
  ): void {
    const element =
      this.resolveTemplateElement(event.currentTarget) ?? this.resolveTemplateElement(event.target);
    if (!element) {
      return;
    }
    this.lastTemplateTarget = target;
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    this.cursorByTarget[target] = { start, end };
  }

  protected onMergeChipDragStart(event: DragEvent, token: string, label: string): void {
    event.dataTransfer?.setData('text/plain', token);
    event.dataTransfer?.setData('application/ecocut-merge-token', token);
    event.dataTransfer?.setData('application/ecocut-merge-label', label);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  protected onMergeChipDragEnd(): void {
    this.mergeDragTarget.set(null);
  }

  protected isMergeDragTarget(target: BroadcastTemplateTarget): boolean {
    return this.mergeDragTarget() === target;
  }

  protected onTemplateDragOver(event: DragEvent, target: BroadcastTemplateTarget): void {
    void event;
    this.mergeDragTarget.set(target);
    this.lastTemplateTarget = target;
  }

  protected onTemplateDragLeave(target: BroadcastTemplateTarget): void {
    if (this.mergeDragTarget() === target) {
      this.mergeDragTarget.set(null);
    }
  }

  protected onTemplateDrop(event: DragEvent, target: BroadcastTemplateTarget): void {
    this.mergeDragTarget.set(null);
    const element =
      this.resolveTemplateElement(event.currentTarget) ?? this.resolveTemplateElement(event.target);
    this.lastTemplateTarget = target;
    if (!element) {
      return;
    }
    queueMicrotask(() => {
      const start = element.selectionStart ?? element.value.length;
      const end = element.selectionEnd ?? start;
      this.cursorByTarget[target] = { start, end };
    });
  }

  protected saveOverrideForPreviewClient(): void {
    this.facade.saveOverrideForPreviewClient();
  }

  protected clearOverrideForPreviewClient(): void {
    this.facade.clearOverrideForPreviewClient();
  }

  protected toggleOverridePanel(): void {
    this.overridePanelOpen.update((isOpen) => !isOpen);
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
    const recipients = this.previewRecipients();
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

  private insertTokenAtTarget(
    target: BroadcastTemplateTarget,
    token: string,
    start: number,
    end: number,
  ): void {
    const control = this.templateControlByTarget[target];
    const value = control.value;
    const safeStart = this.clampCursor(start, value.length);
    const safeEnd = this.clampCursor(Math.max(end, safeStart), value.length);
    const nextValue = `${value.slice(0, safeStart)}${token}${value.slice(safeEnd)}`;
    const nextCursor = safeStart + token.length;
    control.setValue(nextValue);
    this.lastTemplateTarget = target;
    this.cursorByTarget[target] = { start: nextCursor, end: nextCursor };
    this.restoreCaret(target, nextCursor);
  }

  private clampCursor(value: number, max: number): number {
    return Math.min(Math.max(value, 0), max);
  }

  private resolveTemplateElement(
    value: EventTarget | null,
  ): HTMLInputElement | HTMLTextAreaElement | null {
    if (value instanceof HTMLInputElement || value instanceof HTMLTextAreaElement) {
      return value;
    }
    return null;
  }

  private restoreCaret(target: BroadcastTemplateTarget, cursor: number): void {
    queueMicrotask(() => {
      const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[data-merge-target="${target}"]`,
      );
      if (!element) {
        return;
      }
      element.focus();
      element.setSelectionRange(cursor, cursor);
    });
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

  private resolveTokenEditor(target: BroadcastTemplateTarget): MergeTokenEditorComponent | null {
    if (target === 'emailSubject') {
      return this.emailSubjectEditor ?? null;
    }
    if (target === 'emailBody') {
      return this.emailBodyEditor ?? null;
    }
    if (target === 'smsBody') {
      return this.smsBodyEditor ?? null;
    }
    return null;
  }

  private resolveMergeLabel(token: string): string {
    const field = this.mergeFields().find(
      (item) => item.token === token || this.mergeFieldEditorToken(item.label) === token,
    );
    if (field) {
      return field.label;
    }
    const match = token.match(/^\[\[(.+)\]\]$/);
    if (match?.[1]) {
      return match[1].trim();
    }
    return token;
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
      {
        label:
          this.channelControl.value === 'both'
            ? 'Message content (Email + SMS)'
            : this.channelControl.value === 'email'
              ? 'Message content (Email)'
              : 'Message content (SMS)',
        isReady: messageReady,
      },
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

  protected toggleManualPanel(): void {
    this.manualPanelOpen.update((open) => !open);
    if (this.manualPanelOpen()) {
      this.manualRecipientNotice.set(null);
      this.manualQueuedClientIds.set([]);
      this.manualSearchControl.setValue('', { emitEvent: false });
      this.manualSearchQuery.set('');
    }
  }

  protected closeManualPanel(): void {
    this.manualPanelOpen.set(false);
    this.manualRecipientNotice.set(null);
    this.manualQueuedClientIds.set([]);
    this.manualSearchControl.setValue('', { emitEvent: false });
    this.manualSearchQuery.set('');
  }

  protected manualPickerRows(): ManualPickerRow[] {
    const query = this.manualSearchQuery().trim().toLowerCase();
    const filteredRecipientIds = new Set(this.filteredRecipients().map((client) => client.clientId));
    const manualRecipientIds = new Set(this.manualRecipients().map((client) => client.clientId));
    const queuedIds = new Set(this.manualQueuedClientIds());
    return this.allRecipients()
      .filter((client) => {
        if (!query) {
          return true;
        }
        return (
          client.fullName.toLowerCase().includes(query) ||
          client.address.toLowerCase().includes(query) ||
          client.phone.toLowerCase().includes(query) ||
          (client.email?.toLowerCase().includes(query) ?? false)
        );
      })
      .map((client) => {
        const isInFilters = filteredRecipientIds.has(client.clientId);
        const isAddedManually = manualRecipientIds.has(client.clientId);
        const canQueue = !isInFilters && !isAddedManually;
        return {
          client,
          isInFilters,
          isAddedManually,
          isQueued: queuedIds.has(client.clientId),
          canQueue,
        };
      });
  }

  protected onManualSearchInput(): void {
    this.manualSearchQuery.set(this.manualSearchControl.value.trim().toLowerCase());
  }

  protected onManualCandidateToggle(clientId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (target.checked) {
      this.manualQueuedClientIds.update((current) =>
        current.includes(clientId) ? current : [...current, clientId],
      );
      return;
    }
    this.manualQueuedClientIds.update((current) =>
      current.filter((queuedClientId) => queuedClientId !== clientId),
    );
  }

  protected addSelectedManualRecipients(): void {
    const queuedIds = this.manualQueuedClientIds();
    if (queuedIds.length === 0) {
      this.manualRecipientNotice.set('Select at least one existing client to add manually.');
      return;
    }

    let addedCount = 0;
    let skippedCount = 0;
    for (const clientId of queuedIds) {
      const result = this.facade.addManualRecipient(clientId);
      if (result === 'added') {
        addedCount += 1;
      } else {
        skippedCount += 1;
      }
    }

    this.manualQueuedClientIds.set([]);
    if (addedCount > 0 && skippedCount === 0) {
      this.manualRecipientNotice.set(
        `Added ${addedCount} client${addedCount === 1 ? '' : 's'} from your roster.`,
      );
      return;
    }
    if (addedCount > 0 && skippedCount > 0) {
      this.manualRecipientNotice.set(
        `Added ${addedCount} client${addedCount === 1 ? '' : 's'}; ${skippedCount} already in audience.`,
      );
      return;
    }
    this.manualRecipientNotice.set('Selected clients are already included by filters or manual picks.');
  }

  protected removeManualRecipient(clientId: string): void {
    this.facade.removeManualRecipient(clientId);
    this.manualQueuedClientIds.update((current) =>
      current.filter((queuedClientId) => queuedClientId !== clientId),
    );
    this.manualRecipientNotice.set('Manual roster selection removed.');
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
    const recipients = this.previewRecipients();
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
