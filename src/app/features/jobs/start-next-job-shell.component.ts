import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
  protected readonly stepFocus = signal<'crew' | 'draft' | 'review' | 'history'>('crew');
  protected readonly canOpenDraftStep = computed(
    () => this.facade.selectedCrew().length > 0,
  );
  protected readonly canOpenReviewStep = computed(
    () => this.facade.selectedCrew().length > 0,
  );
  protected readonly canOpenHistoryStep = computed(
    () =>
      this.facade.selectedCrew().length > 0 || this.facade.scheduledHistoryCount() > 0,
  );
  private readonly jobLabelValue = toSignal(this.facade.jobLabelControl.valueChanges, {
    initialValue: this.facade.jobLabelControl.value,
  });
  private readonly addressValue = toSignal(this.facade.addressControl.valueChanges, {
    initialValue: this.facade.addressControl.value,
  });
  private readonly scheduledStartValue = toSignal(
    this.facade.scheduledStartControl.valueChanges,
    {
      initialValue: this.facade.scheduledStartControl.value,
    },
  );
  private readonly scheduledEndValue = toSignal(this.facade.scheduledEndControl.valueChanges, {
    initialValue: this.facade.scheduledEndControl.value,
  });
  protected readonly hasDraftBasics = computed(() => {
    return (
      this.jobLabelValue().trim().length > 0 &&
      this.addressValue().trim().length > 0 &&
      this.scheduledStartValue().trim().length > 0 &&
      this.scheduledEndValue().trim().length > 0
    );
  });

  ngOnInit(): void {
    void this.facade.loadBoard();
  }

  protected setStepFocus(step: 'crew' | 'draft' | 'review' | 'history'): void {
    if (step === 'draft' && !this.canOpenDraftStep()) {
      return;
    }
    if (step === 'review' && !this.canOpenReviewStep()) {
      return;
    }
    if (step === 'history' && !this.canOpenHistoryStep()) {
      return;
    }
    this.stepFocus.set(step);
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

  private scrollToSection(sectionId: string): void {
    const section = document.getElementById(sectionId);
    if (section && typeof section.scrollIntoView === 'function') {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
