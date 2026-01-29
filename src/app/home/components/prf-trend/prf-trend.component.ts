import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { TrendPoint } from '../../home.models';

@Component({
  selector: 'app-prf-trend',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './prf-trend.component.html',
  styleUrl: './prf-trend.component.scss',
})
export class PrfTrendComponent {
  @Input() points: TrendPoint[] | null = [];

  protected get maxValue(): number {
    return Math.max(...(this.points?.map((point) => point.value) ?? [1]));
  }

  protected calcWidth(value: number): string {
    if (!this.maxValue) return '0%';
    return `${Math.round((value / this.maxValue) * 100)}%`;
  }
}
