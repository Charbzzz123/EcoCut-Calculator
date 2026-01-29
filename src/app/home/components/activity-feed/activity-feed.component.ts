import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { ActivityItem } from '../../home.models';

const currencyFormatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

@Component({
  selector: 'app-activity-feed',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './activity-feed.component.html',
  styleUrl: './activity-feed.component.scss',
})
export class ActivityFeedComponent {
  @Input() jobs: ActivityItem[] | null = [];

  protected formatCurrency(value: number): string {
    return currencyFormatter.format(value);
  }

  protected formatTimestamp(timestamp: string): string {
    return dateFormatter.format(new Date(timestamp));
  }

  protected trackById(_: number, item: ActivityItem): string {
    return item.id;
  }
}
