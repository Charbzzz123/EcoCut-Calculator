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
  readonly loadState = this.facade.loadState;
  readonly statusFilter = this.facade.statusFilter;
  readonly statsSnapshot = () => this.facade.statsSnapshot();
  readonly rosterSnapshot = () => this.facade.rosterSnapshot();
  readonly filteredRosterSnapshot = () => this.facade.filteredRosterSnapshot();
  readonly trackByEmployeeId = this.facade.trackByEmployeeId;
  readonly nextSlices = [
    'Profile editor (create, update, archive)',
    'Hours workflow with role-based restrictions',
    'Per-employee job history timeline for Start Next Job',
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
}
