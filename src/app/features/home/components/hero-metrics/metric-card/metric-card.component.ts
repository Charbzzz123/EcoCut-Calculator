import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { HeroMetric } from '../../../home.models.js';

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
        return '\u25B2';
      case 'down':
        return '\u25BC';
      default:
        return '\u2192';
    }
  }
}

