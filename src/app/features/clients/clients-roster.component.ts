import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { ClientSummary } from '@shared/domain/entry/entry-repository.service.js';
import type { ClientsLoadState } from './clients.types.js';

@Component({
  selector: 'app-clients-roster',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './clients-roster.component.html',
  styleUrl: './clients-roster.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsRosterComponent {
  @Input({ required: true }) loadState: ClientsLoadState = 'loading';
  @Input({ required: true }) clients: ClientSummary[] = [];
  @Input({ required: true }) trackByClient!: (index: number, client: ClientSummary) => string;
  @Output() selectClient = new EventEmitter<ClientSummary>();
  @Output() reload = new EventEmitter<void>();
}
