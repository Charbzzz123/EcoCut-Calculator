import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { ClientDetail, ClientHistoryEntry, ClientSummary } from '../home/services/entry-repository.service.js';

export type ClientDetailState = 'loading' | 'ready' | 'error';

@Component({
  standalone: true,
  selector: 'app-client-detail-drawer',
  templateUrl: './client-detail-drawer.component.html',
  styleUrls: ['./client-detail-drawer.component.scss'],
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDetailDrawerComponent {
  @Input({ required: true }) client!: ClientSummary;
  @Input() detail: ClientDetail | null = null;
  @Input() state: ClientDetailState = 'loading';
  @Output() closed = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();

  trackHistory(_: number, history: ClientHistoryEntry): string {
    return history.entryId;
  }
}
