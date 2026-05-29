import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  signal,
} from '@angular/core';
import type {
  ClientDetail,
  ClientSummary,
  ClientHistoryEntry,
  UpdateClientPayload,
} from '@shared/domain/entry/entry-repository.service.js';
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
export class ClientDetailOverlayComponent implements OnDestroy {
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly closing = signal(false);

  @Input({ required: true }) client!: ClientSummary;
  @Input() detail: ClientDetail | null = null;
  @Input() state: ClientDetailState = 'loading';

  @Output() closed = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();
  @Output() updateClient = new EventEmitter<UpdateClientPayload>();
  @Output() deleteClient = new EventEmitter<void>();
  @Output() editEntry = new EventEmitter<ClientHistoryEntry>();
  @Output() deleteEntry = new EventEmitter<ClientHistoryEntry>();

  protected requestClose(): void {
    if (this.closing()) {
      return;
    }
    this.closing.set(true);
    this.clearCloseTimer();
    this.closeTimer = setTimeout(() => {
      this.closed.emit();
      this.closing.set(false);
      this.closeTimer = null;
    }, 220);
  }

  private clearCloseTimer(): void {
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.clearCloseTimer();
  }
}
