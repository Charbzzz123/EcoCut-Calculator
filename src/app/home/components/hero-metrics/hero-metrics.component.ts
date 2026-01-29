import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { HeroMetric } from '../../home.models';
import { MetricCardComponent } from './metric-card/metric-card.component';

@Component({
  selector: 'app-hero-metrics',
  standalone: true,
  imports: [CommonModule, MetricCardComponent],
  templateUrl: './hero-metrics.component.html',
  styleUrl: './hero-metrics.component.scss',
})
export class HeroMetricsComponent {
  @Input() metrics: HeroMetric[] | null = [];

  protected trackById(_: number, metric: HeroMetric): string {
    return metric.id;
  }
}
