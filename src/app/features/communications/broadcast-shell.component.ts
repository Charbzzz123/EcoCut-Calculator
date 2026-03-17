import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import type { ClientSummary } from '@shared/domain/entry/entry-repository.service.js';
import { BackChipComponent } from '@shared/ui/back-chip/back-chip.component.js';
import { BrandBannerComponent } from '@shared/ui/brand-banner/brand-banner.component.js';
import { BroadcastFacade } from './broadcast.facade.js';
import type { BroadcastTemplateTarget } from './broadcast.types.js';

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

  protected readonly headingId = 'broadcast-heading';
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
  ngOnInit(): void {
    void this.facade.loadRecipients();
  }

  protected reloadRecipients(): void {
    void this.facade.loadRecipients();
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
    const hasEmailDestination = this.testEmailControl.value.trim().length > 0;
    const hasPhoneDestination = this.isSmsCapable(this.testPhoneControl.value);
    if (channel === 'email' && !hasEmailDestination) {
      return 'Add a test email destination.';
    }
    if (channel === 'sms' && !hasPhoneDestination) {
      return 'Add a valid test SMS destination.';
    }
    if (channel === 'both' && (!hasEmailDestination || !hasPhoneDestination)) {
      return 'Add both test email and test SMS destinations.';
    }
    return null;
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

  protected canConfirmDispatch(): boolean {
    return this.dispatchBlockedReason() === null;
  }

  protected canSendTest(): boolean {
    return this.testBlockedReason() === null;
  }

  protected readinessChecklist(): { label: string; isReady: boolean }[] {
    const recipientsReady = this.counts().total > 0;
    const channelReady = this.channelValidationMessage() === null;
    const messageReady = this.isMessageReadyForChannel();
    const scheduleReady = this.scheduleModeControl.value === 'now' || this.hasScheduledTimestamp();
    return [
      { label: 'Recipients selected', isReady: recipientsReady },
      { label: 'Channel eligibility', isReady: channelReady },
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
}
