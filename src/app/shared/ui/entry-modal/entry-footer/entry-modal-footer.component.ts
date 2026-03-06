import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-entry-modal-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './entry-modal-footer.component.html',
  styleUrl: './entry-modal-footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntryModalFooterComponent {
  @Input({ required: true }) primaryLabel = 'Save';
  @Input({ required: true }) primaryDisabled = false;
  @Output() dismiss = new EventEmitter<void>();
}
