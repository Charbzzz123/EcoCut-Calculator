import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BackChipComponent } from '@shared/ui/back-chip/back-chip.component.js';
import { BrandBannerComponent } from '@shared/ui/brand-banner/brand-banner.component.js';
import type { EmployeeHoursRecord, EmployeeLoggedJobOption } from './employees.types.js';
import { EmployeesFacade } from './employees.facade.js';

@Component({
  standalone: true,
  selector: 'app-manage-employees-shell',
  templateUrl: './manage-employees-shell.component.html',
  styleUrls: ['./manage-employees-shell.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, BrandBannerComponent, BackChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManageEmployeesShellComponent implements OnInit {
  protected readonly facade = inject(EmployeesFacade);
  protected readonly workspaceFocus = signal<
    'roster' | 'clock' | 'profile' | 'hours' | 'history' | 'readiness'
  >('roster');
  protected readonly expandedEmployeeId = signal<string | null>(null);
  protected readonly inlinePanel = signal<'profile' | 'hours' | 'history' | null>(null);

  readonly headingId = this.facade.headingId;
  readonly queryControl = this.facade.queryControl;
  readonly roleControl = this.facade.roleControl;
  readonly profileForm = this.facade.profileForm;
  readonly hoursForm = this.facade.hoursForm;
  readonly loadState = this.facade.loadState;
  readonly statusFilter = this.facade.statusFilter;
  readonly operatorRole = this.facade.operatorRole;
  readonly canEditExistingProfiles = this.facade.canEditExistingProfiles;
  readonly canArchiveProfiles = this.facade.canArchiveProfiles;
  readonly workspaceNotice = this.facade.workspaceNotice;
  readonly profileEditorOpen = this.facade.profileEditorOpen;
  readonly profileEditorMode = this.facade.profileEditorMode;
  readonly profileErrors = this.facade.profileErrors;
  readonly activeEmployee = this.facade.activeEmployee;
  readonly hoursEditorOpen = this.facade.hoursEditorOpen;
  readonly selectedHoursEmployee = this.facade.selectedHoursEmployee;
  readonly selectedHoursEntries = this.facade.selectedHoursEntries;
  readonly selectedHoursTotals = this.facade.selectedHoursTotals;
  readonly loggedJobOptions = this.facade.loggedJobOptions;
  readonly selectedHoursJobOption = this.facade.selectedHoursJobOption;
  readonly isManualHoursSelection = this.facade.isManualHoursSelection;
  readonly editingHoursEntry = this.facade.editingHoursEntry;
  readonly hoursErrors = this.facade.hoursErrors;
  readonly hoursSuccess = this.facade.hoursSuccess;
  readonly historyPanelOpen = this.facade.historyPanelOpen;
  readonly selectedHistoryEmployee = this.facade.selectedHistoryEmployee;
  readonly selectedEmployeeJobHistory = this.facade.selectedEmployeeJobHistory;
  readonly selectedHistorySummary = this.facade.selectedHistorySummary;
  readonly startNextJobReadiness = this.facade.startNextJobReadiness;
  readonly clockSummaries = this.facade.clockSummaries;
  readonly statsSnapshot = () => this.facade.statsSnapshot();
  readonly rosterSnapshot = () => this.facade.rosterSnapshot();
  readonly filteredRosterSnapshot = () => this.facade.filteredRosterSnapshot();
  readonly trackByEmployeeId = this.facade.trackByEmployeeId;
  readonly trackByHoursEntryId = this.facade.trackByHoursEntryId;
  readonly trackByHistoryEntryId = this.facade.trackByHistoryEntryId;
  readonly trackByReadinessEmployeeId = this.facade.trackByReadinessEmployeeId;
  readonly trackByClockEmployeeId = this.facade.trackByClockEmployeeId;

  ngOnInit(): void {
    void this.facade.loadRoster();
  }

  protected setWorkspaceFocus(
    focus: 'roster' | 'clock' | 'profile' | 'hours' | 'history' | 'readiness',
  ): void {
    this.workspaceFocus.set(focus);
    this.scrollToSection(`employees-${focus}`);
  }

  protected refreshRoster(): void {
    void this.facade.loadRoster();
  }

  protected setStatusFilter(filter: 'all' | 'active' | 'inactive'): void {
    this.facade.setStatusFilter(filter);
  }

  protected openCreateProfile(): void {
    this.expandedEmployeeId.set(null);
    this.inlinePanel.set(null);
    this.workspaceFocus.set('profile');
    this.facade.openCreateProfile();
  }

  protected openEditProfile(employeeId: string): void {
    this.expandedEmployeeId.set(employeeId);
    this.inlinePanel.set('profile');
    this.workspaceFocus.set('roster');
    this.facade.openEditProfile(employeeId);
  }

  protected archiveEmployee(employeeId: string): void {
    void this.facade.archiveEmployee(employeeId);
  }

  protected restoreEmployee(employeeId: string): void {
    void this.facade.restoreEmployee(employeeId);
  }

  protected openHoursEditor(employeeId: string): void {
    this.expandedEmployeeId.set(employeeId);
    this.inlinePanel.set('hours');
    this.workspaceFocus.set('roster');
    this.facade.openHoursEditor(employeeId);
  }

  protected openJobHistory(employeeId: string): void {
    this.expandedEmployeeId.set(employeeId);
    this.inlinePanel.set('history');
    this.workspaceFocus.set('roster');
    this.facade.openJobHistory(employeeId);
  }

  protected closeHoursEditor(): void {
    this.inlinePanel.set(null);
    this.facade.closeHoursEditor();
  }

  protected closeJobHistory(): void {
    this.inlinePanel.set(null);
    this.facade.closeJobHistory();
  }

  protected clockIn(employeeId: string): void {
    this.workspaceFocus.set('clock');
    void this.facade.clockIn(employeeId);
  }

  protected clockOut(employeeId: string): void {
    this.workspaceFocus.set('clock');
    void this.facade.clockOut(employeeId);
  }

  protected editHoursEntry(entryId: string): void {
    this.facade.editHoursEntry(entryId);
  }

  protected removeHoursEntry(entryId: string): void {
    void this.facade.removeHoursEntry(entryId);
  }

  protected async saveProfile(): Promise<void> {
    const saved = await this.facade.saveProfile();
    if (saved) {
      this.inlinePanel.set(null);
    }
  }

  protected saveHoursEntry(): void {
    void this.facade.saveHoursEntry();
  }

  protected cancelProfileEditor(): void {
    this.inlinePanel.set(null);
    this.workspaceFocus.set('roster');
    this.facade.cancelProfileEditor();
  }

  protected toggleEmployeeExpansion(employeeId: string, event?: Event): void {
    const target = event?.target as HTMLElement | null;
    if (target?.closest('.employee-inline-panel') || target?.closest('.employee-card__actions')) {
      return;
    }
    if (this.expandedEmployeeId() === employeeId) {
      this.expandedEmployeeId.set(null);
      this.inlinePanel.set(null);
      this.facade.closeHoursEditor();
      this.facade.closeJobHistory();
      this.facade.cancelProfileEditor();
      return;
    }
    this.expandedEmployeeId.set(employeeId);
    this.inlinePanel.set(null);
  }

  protected isEmployeeExpanded(employeeId: string): boolean {
    return this.expandedEmployeeId() === employeeId;
  }

  protected isInlinePanelOpen(employeeId: string, panel: 'profile' | 'hours' | 'history'): boolean {
    return this.expandedEmployeeId() === employeeId && this.inlinePanel() === panel;
  }

  protected handleEmployeeCardKeydown(event: KeyboardEvent, employeeId: string): void {
    const target = event.target as HTMLElement | null;
    if (
      target?.closest('.employee-inline-panel') ||
      target?.closest('input, textarea, select, button')
    ) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleEmployeeExpansion(employeeId);
    }
  }

  protected resolveHoursLinkedJob(entry: EmployeeHoursRecord): EmployeeLoggedJobOption | null {
    if (!entry.jobEntryId) {
      return null;
    }
    return this.loggedJobOptions().find((job) => job.entryId === entry.jobEntryId) ?? null;
  }

  protected isLinkedHoursEntry(entry: EmployeeHoursRecord): boolean {
    return Boolean(entry.jobEntryId);
  }

  private scrollToSection(sectionId: string): void {
    const section = document.getElementById(sectionId);
    if (section && typeof section.scrollIntoView === 'function') {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
