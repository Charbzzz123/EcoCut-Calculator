import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AddressAutocompleteFieldComponent } from '@shared/ui/address-autocomplete-field/address-autocomplete-field.component.js';
import { BackChipComponent } from '@shared/ui/back-chip/back-chip.component.js';
import { BrandBannerComponent } from '@shared/ui/brand-banner/brand-banner.component.js';
import { StartNextJobFacade } from './start-next-job.facade.js';

@Component({
  standalone: true,
  selector: 'app-start-next-job-shell',
  templateUrl: './start-next-job-shell.component.html',
  styleUrls: ['./start-next-job-shell.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BrandBannerComponent,
    BackChipComponent,
    AddressAutocompleteFieldComponent,
  ],
  providers: [StartNextJobFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartNextJobShellComponent implements OnInit, OnDestroy {
  private static readonly SAVE_TOAST_CLOSE_DELAY_MS = 180;
  protected readonly facade = inject(StartNextJobFacade);
  protected readonly stepFocus = signal<'crew' | 'draft' | 'review' | 'history'>('draft');
  protected readonly workflowStatusExpanded = signal(false);
  protected readonly draftAdvancedExpanded = signal(false);
  protected readonly analyticsPanelExpanded = signal(false);
  protected readonly analyticsExpanded = signal(false);
  protected readonly saveToastClosing = signal(false);
  private readonly saveToastSnapshot = signal<{
    state: 'idle' | 'saving' | 'success' | 'error';
    message: string;
  } | null>(null);
  protected readonly shouldRenderSaveToast = computed(() => this.saveToastSnapshot() !== null);
  protected readonly saveToastState = computed(() => this.saveToastSnapshot()?.state ?? 'idle');
  protected readonly saveToastMessage = computed(() => this.saveToastSnapshot()?.message ?? '');
  protected readonly canOpenCrewStep = computed(() => this.facade.hasJobModeSelection());
  protected readonly canOpenReviewStep = computed(
    () => this.facade.hasJobModeSelection() && this.facade.selectedCrew().length > 0,
  );
  protected readonly canOpenHistoryStep = computed(
    () => this.facade.selectedCrew().length > 0 || this.facade.scheduledHistoryCount() > 0,
  );
  protected readonly ongoingRuns = this.facade.ongoingRuns;
  private saveToastCloseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const state = this.facade.saveState();
      const message = this.facade.saveMessage().trim();

      if (state !== 'idle' && message.length > 0) {
        this.clearSaveToastCloseTimer();
        this.saveToastClosing.set(false);
        this.saveToastSnapshot.set({ state, message });
        return;
      }

      if (!this.saveToastSnapshot()) {
        return;
      }

      if (this.prefersReducedMotion()) {
        this.saveToastSnapshot.set(null);
        this.saveToastClosing.set(false);
        return;
      }

      if (this.saveToastClosing()) {
        return;
      }

      this.saveToastClosing.set(true);
      this.clearSaveToastCloseTimer();
      this.saveToastCloseTimer = setTimeout(() => {
        this.saveToastSnapshot.set(null);
        this.saveToastClosing.set(false);
        this.saveToastCloseTimer = null;
      }, StartNextJobShellComponent.SAVE_TOAST_CLOSE_DELAY_MS);
    });
  }

  ngOnInit(): void {
    void this.facade.loadBoard();
  }

  ngOnDestroy(): void {
    this.clearSaveToastCloseTimer();
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
    if (step === 'crew' || step === 'review') {
      this.facade.refreshStartNowSchedule();
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

  protected toggleWorkflowStatusExpanded(): void {
    this.workflowStatusExpanded.update((expanded) => !expanded);
  }

  protected toggleAnalyticsPanelExpanded(): void {
    this.analyticsPanelExpanded.update((expanded) => !expanded);
  }

  protected workflowProgressSummary(): string {
    const focus = this.stepFocus();
    if (focus === 'draft') {
      return this.facade.hasJobModeSelection()
        ? 'Step 1: Linked job mode selected.'
        : 'Step 1: Choose linked job or manual mode.';
    }
    if (focus === 'crew') {
      return this.canOpenReviewStep()
        ? 'Step 2: Crew selected.'
        : 'Step 2: Select at least 1 crew member.';
    }
    return this.facade.draftValidation().isReady
      ? 'Step 3: Ready to save.'
      : 'Step 3: Review conflicts and validation blockers.';
  }

  protected isWorkflowStepActive(step: 'draft' | 'crew' | 'review'): boolean {
    const focus = this.stepFocus();
    if (step === 'review') {
      return focus === 'review' || focus === 'history';
    }
    return focus === step;
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

  protected endOngoingRun(entryId: string): void {
    this.requestEndRun(entryId, true);
  }

  protected endHistoryRun(entryId: string): void {
    this.requestEndRun(entryId, false);
  }

  private requestEndRun(entryId: string, switchToHistory: boolean): void {
    const note = globalThis.prompt(
      'Optional completion note (leave blank to end without note):',
      '',
    );
    if (note === null) {
      return;
    }
    const normalizedNote = note.trim();
    const confirmed = globalThis.confirm(
      normalizedNote
        ? `End this ongoing job now?\n\nNote: ${normalizedNote}`
        : 'End this ongoing job now?',
    );
    if (!confirmed) {
      return;
    }
    if (switchToHistory) {
      this.setStepFocus('history');
    }
    void this.facade.endHistoryRun(entryId, 'owner', normalizedNote || null);
  }

  protected ongoingRunStateLabel(state: 'on_schedule' | 'late' | 'early_start'): string {
    if (state === 'late') {
      return 'Late';
    }
    if (state === 'early_start') {
      return 'Early start';
    }
    return 'On schedule';
  }

  protected async savePrimaryAction(): Promise<void> {
    if (this.facade.editingHistoryEntryId()) {
      const updated = await this.facade.submitHistoryEdit();
      if (updated) {
        this.setStepFocus('history');
      }
      return;
    }

    const saved = await this.facade.submitAssignment();
    if (saved) {
      this.setStepFocus('draft');
    }
  }

  protected blockerActionLabel(reason: string): string | null {
    if (
      reason === 'Select a linked job mode (linked client job or manual mode).' ||
      reason === 'Job label is required.' ||
      reason === 'Job address is required.' ||
      reason === 'Selected linked job is already running.' ||
      reason === 'Scheduled start and end are required.' ||
      reason === 'Scheduled end must be after scheduled start.'
    ) {
      return 'Fix in Step 1';
    }
    if (
      reason === 'Select at least one employee for the crew.' ||
      reason === 'Resolve crew conflicts before creating the assignment draft.'
    ) {
      return 'Go to Step 2';
    }
    if (
      reason === 'Continuity category is required when using a completed linked job.' ||
      reason === 'Continuity reason is required when using a completed linked job.'
    ) {
      return 'Open continuity';
    }
    return null;
  }

  protected handleBlockerAction(reason: string): void {
    if (
      reason === 'Select at least one employee for the crew.' ||
      reason === 'Resolve crew conflicts before creating the assignment draft.'
    ) {
      this.setStepFocus('crew');
      return;
    }
    if (
      reason === 'Continuity category is required when using a completed linked job.' ||
      reason === 'Continuity reason is required when using a completed linked job.'
    ) {
      this.setStepFocus('draft');
      this.draftAdvancedExpanded.set(true);
      return;
    }
    if (
      reason === 'Select a linked job mode (linked client job or manual mode).' ||
      reason === 'Job label is required.' ||
      reason === 'Job address is required.' ||
      reason === 'Selected linked job is already running.' ||
      reason === 'Scheduled start and end are required.' ||
      reason === 'Scheduled end must be after scheduled start.'
    ) {
      this.setStepFocus('draft');
    }
  }

  private scrollToSection(sectionId: string): void {
    setTimeout(() => {
      const section = document.getElementById(sectionId);
      if (section && typeof section.scrollIntoView === 'function') {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  private clearSaveToastCloseTimer(): void {
    if (this.saveToastCloseTimer !== null) {
      clearTimeout(this.saveToastCloseTimer);
      this.saveToastCloseTimer = null;
    }
  }

  private prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
