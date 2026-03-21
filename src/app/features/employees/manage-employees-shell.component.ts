import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BackChipComponent } from '@shared/ui/back-chip/back-chip.component.js';
import { BrandBannerComponent } from '@shared/ui/brand-banner/brand-banner.component.js';

@Component({
  standalone: true,
  selector: 'app-manage-employees-shell',
  templateUrl: './manage-employees-shell.component.html',
  styleUrls: ['./manage-employees-shell.component.scss'],
  imports: [BrandBannerComponent, BackChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManageEmployeesShellComponent {
  readonly headingId = 'manage-employees-heading';
  readonly plannedSlices = [
    'Employee roster with search and active/inactive filters',
    'Profile editor with archive-safe lifecycle',
    'Hours updates with manager/owner role guards',
    'Per-employee job history tied to future Start Next Job assignments',
  ] as const;
}
