import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
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

  ngOnInit(): void {
    void this.facade.loadBoard();
  }

  protected setStepFocus(step: 'crew' | 'draft' | 'review' | 'history'): void {
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
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
