import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { HeroMetric } from '../../../home.models';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metric-card.component.html',
  styleUrl: './metric-card.component.scss',
})
export class MetricCardComponent {
  @Input({ required: true }) metric!: HeroMetric;

  protected get trendIcon(): string {
    switch (this.metric.trend) {
      case 'up':
        return '?';
      case 'down':
        return '?';
      default:
        return '?';
    }
  }
}
