import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
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
  readonly statsSnapshot = () => this.facade.statsSnapshot();
  readonly rosterSnapshot = () => this.facade.rosterSnapshot();
  readonly filteredRosterSnapshot = () => this.facade.filteredRosterSnapshot();
  readonly trackByEmployeeId = this.facade.trackByEmployeeId;
  readonly trackByHoursEntryId = this.facade.trackByHoursEntryId;
  readonly nextSlices = [
    'Per-employee job history timeline for Start Next Job',
    'History totals by site and rolling 7-day/30-day views',
    'Start Next Job readiness data contract',
  ] as const;

  ngOnInit(): void {
    void this.facade.loadRoster();
  }

  protected refreshRoster(): void {
    void this.facade.loadRoster();
  }

  protected setStatusFilter(filter: 'all' | 'active' | 'inactive'): void {
    this.facade.setStatusFilter(filter);
  }

  protected openCreateProfile(): void {
    this.facade.openCreateProfile();
  }

  protected openEditProfile(employeeId: string): void {
    this.facade.openEditProfile(employeeId);
  }

  protected archiveEmployee(employeeId: string): void {
    this.facade.archiveEmployee(employeeId);
  }

  protected openHoursEditor(employeeId: string): void {
    this.facade.openHoursEditor(employeeId);
  }

  protected closeHoursEditor(): void {
    this.facade.closeHoursEditor();
  }

  protected editHoursEntry(entryId: string): void {
    this.facade.editHoursEntry(entryId);
  }

  protected removeHoursEntry(entryId: string): void {
    this.facade.removeHoursEntry(entryId);
  }

  protected saveProfile(): void {
    this.facade.saveProfile();
  }

  protected saveHoursEntry(): void {
    this.facade.saveHoursEntry();
  }

  protected cancelProfileEditor(): void {
    this.facade.cancelProfileEditor();
  }
}
