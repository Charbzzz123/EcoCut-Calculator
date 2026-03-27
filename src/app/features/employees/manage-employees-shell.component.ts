import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BackChipComponent } from '@shared/ui/back-chip/back-chip.component.js';
import { BrandBannerComponent } from '@shared/ui/brand-banner/brand-banner.component.js';
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
    this.workspaceFocus.set('profile');
    this.facade.openCreateProfile();
  }

  protected openEditProfile(employeeId: string): void {
    this.workspaceFocus.set('profile');
    this.facade.openEditProfile(employeeId);
  }

  protected archiveEmployee(employeeId: string): void {
    void this.facade.archiveEmployee(employeeId);
  }

  protected openHoursEditor(employeeId: string): void {
    this.workspaceFocus.set('hours');
    this.facade.openHoursEditor(employeeId);
  }

  protected openJobHistory(employeeId: string): void {
    this.workspaceFocus.set('history');
    this.facade.openJobHistory(employeeId);
  }

  protected closeHoursEditor(): void {
    this.workspaceFocus.set('roster');
    this.facade.closeHoursEditor();
  }

  protected closeJobHistory(): void {
    this.workspaceFocus.set('roster');
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

  protected saveProfile(): void {
    void this.facade.saveProfile();
  }

  protected saveHoursEntry(): void {
    void this.facade.saveHoursEntry();
  }

  protected cancelProfileEditor(): void {
    this.workspaceFocus.set('roster');
    this.facade.cancelProfileEditor();
  }

  private scrollToSection(sectionId: string): void {
    const section = document.getElementById(sectionId);
    if (section && typeof section.scrollIntoView === 'function') {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
