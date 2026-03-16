import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BackChipComponent } from '@shared/ui/back-chip/back-chip.component.js';
import { BrandBannerComponent } from '@shared/ui/brand-banner/brand-banner.component.js';

@Component({
  standalone: true,
  selector: 'app-broadcast-shell',
  templateUrl: './broadcast-shell.component.html',
  styleUrl: './broadcast-shell.component.scss',
  imports: [CommonModule, BrandBannerComponent, BackChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BroadcastShellComponent {
  protected readonly headingId = 'broadcast-heading';
}
