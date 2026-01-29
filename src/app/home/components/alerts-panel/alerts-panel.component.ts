import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { AlertItem } from '../../home.models';

@Component({
  selector: 'app-alerts-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alerts-panel.component.html',
  styleUrl: './alerts-panel.component.scss',
})
export class AlertsPanelComponent {
  @Input() alerts: AlertItem[] | null = [];

  protected trackById(_: number, alert: AlertItem): string {
    return alert.id;
  }
}
