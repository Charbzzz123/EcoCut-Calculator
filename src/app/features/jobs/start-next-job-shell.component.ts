import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BackChipComponent } from '@shared/ui/back-chip/back-chip.component.js';
import { BrandBannerComponent } from '@shared/ui/brand-banner/brand-banner.component.js';
import { StartNextJobFacade } from './start-next-job.facade.js';

@Component({
  standalone: true,
  selector: 'app-start-next-job-shell',
  templateUrl: './start-next-job-shell.component.html',
  styleUrls: ['./start-next-job-shell.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, BrandBannerComponent, BackChipComponent],
  providers: [StartNextJobFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartNextJobShellComponent implements OnInit {
  protected readonly facade = inject(StartNextJobFacade);
  protected readonly stepFocus = signal<'crew' | 'draft' | 'review' | 'history'>('draft');
  protected readonly draftAdvancedExpanded = signal(false);
  protected readonly analyticsPanelExpanded = signal(false);
  protected readonly analyticsExpanded = signal(false);
  protected readonly canOpenCrewStep = computed(() => this.facade.hasJobModeSelection());
  protected readonly canOpenReviewStep = computed(
    () => this.facade.hasJobModeSelection() && this.facade.selectedCrew().length > 0,
  );
  protected readonly canOpenHistoryStep = computed(
    () => this.facade.selectedCrew().length > 0 || this.facade.scheduledHistoryCount() > 0,
  );

  ngOnInit(): void {
    void this.facade.loadBoard();
  }

  protected setStepFocus(step: 'crew' | 'draft' | 'review' | 'history'): void {
    if (step === 'crew' && !this.canOpenCrewStep()) {
      return;
    }
    if (step === 'review' && !this.canOpenReviewStep()) {
      return;
    }
    if (step === 'history' && !this.canOpenHistoryStep()) {
      return;
    }
    this.stepFocus.set(step);
    if (step === 'review') {
      this.analyticsPanelExpanded.set(true);
    }
    this.scrollToSection(`start-next-${step}`);
  }

  protected exportAssignmentAnalytics(): void {
    const exportPayload = this.facade.createAssignmentAnalyticsExport();
    if (!exportPayload) {
      return;
    }
    const blob = new Blob([exportPayload.csvContent], { type: 'text/csv;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = exportPayload.filename;
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
  }

  protected toggleAnalyticsExpanded(): void {
    this.analyticsExpanded.update((expanded) => !expanded);
  }

  protected toggleDraftAdvancedExpanded(): void {
    this.draftAdvancedExpanded.update((expanded) => !expanded);
  }

  protected toggleAnalyticsPanelExpanded(): void {
    this.analyticsPanelExpanded.update((expanded) => !expanded);
  }

  protected clockOutRunMember(entryId: string): void {
    const note = globalThis.prompt(
      'Optional clock-out note (leave blank to continue):',
      '',
    );
    if (note === null) {
      return;
    }
    void this.facade.clockOutHistoryMember(entryId, note);
  }

  private scrollToSection(sectionId: string): void {
    setTimeout(() => {
      const section = document.getElementById(sectionId);
      if (section && typeof section.scrollIntoView === 'function') {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
}
