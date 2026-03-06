import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';

type RouterTarget = string | readonly unknown[];

@Component({
  selector: 'app-brand-banner',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './brand-banner.component.html',
  styleUrl: './brand-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandBannerComponent {
  @Input() routerLink: RouterTarget = '/';
  @Input() ariaLabel = 'Back to EcoCut home via EcoCut branding';
  @Input() logoSrc = 'assets/brand/eco-logo.png';
  @Input() logoAlt = 'EcoCut logo';
  @Input()
  get mascotSrc(): string {
    return this._mascotSrc;
  }
  set mascotSrc(value: string) {
    const next = value?.trim() || this.defaultMascotSrc;
    this._mascotSrc = next;
    this.mascotSource = next;
  }

  @Input() mascotAlt = 'EcoCut mascot';
  @Input() showMascot = true;

  private readonly defaultMascotSrc = 'assets/brand/eco-mascot.png';
  private _mascotSrc = this.defaultMascotSrc;
  private mascotSource = this.defaultMascotSrc;

  protected safeMascotSrc(): string {
    return this.mascotSource;
  }

  protected handleMascotError(): void {
    this.mascotSource = 'assets/brand/mascot-placeholder.svg';
  }
}
