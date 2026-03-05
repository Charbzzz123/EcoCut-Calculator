import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type {
  ClientDetail,
  ClientSummary,
  ClientHistoryEntry,
  UpdateClientPayload,
} from '../home/services/entry-repository.service.js';
import type { ClientDetailState } from './clients.types.js';
import { ClientDetailDrawerComponent } from './client-detail-drawer.component.js';

@Component({
  selector: 'app-client-detail-overlay',
  standalone: true,
  imports: [CommonModule, ClientDetailDrawerComponent],
  templateUrl: './client-detail-overlay.component.html',
  styleUrl: './client-detail-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDetailOverlayComponent {
  @Input({ required: true }) client!: ClientSummary;
  @Input() detail: ClientDetail | null = null;
  @Input() state: ClientDetailState = 'loading';

  @Output() closed = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();
  @Output() updateClient = new EventEmitter<UpdateClientPayload>();
  @Output() deleteClient = new EventEmitter<void>();
  @Output() editEntry = new EventEmitter<ClientHistoryEntry>();
  @Output() deleteEntry = new EventEmitter<ClientHistoryEntry>();
}
