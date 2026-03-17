import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BackChipComponent } from '@shared/ui/back-chip/back-chip.component.js';
import { BrandBannerComponent } from '@shared/ui/brand-banner/brand-banner.component.js';
import { BroadcastFacade } from './broadcast.facade.js';
import type { BroadcastTemplateTarget } from './broadcast.types.js';

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
}
