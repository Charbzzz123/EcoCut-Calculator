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
  protected readonly previewPayload = this.facade.previewPayload;
  protected readonly smsMetrics = this.facade.smsMetrics;

  ngOnInit(): void {
    void this.facade.loadRecipients();
  }

  protected reloadRecipients(): void {
    void this.facade.loadRecipients();
  }

  protected insertMergeField(target: BroadcastTemplateTarget, token: string): void {
    this.facade.insertMergeField(target, token);
  }
}
