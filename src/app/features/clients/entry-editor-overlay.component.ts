import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { EntryModalPayload, EntryVariant } from '@shared/domain/entry/entry-modal.models.js';
import { EntryModalComponent } from '@shared/ui/entry-modal/entry-modal.component.js';

@Component({
  selector: 'app-entry-editor-overlay',
  standalone: true,
  imports: [CommonModule, EntryModalComponent],
  templateUrl: './entry-editor-overlay.component.html',
  styleUrl: './entry-editor-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntryEditorOverlayComponent {
  @Input({ required: true }) open = false;
  @Input({ required: true }) variant: EntryVariant = 'warm-lead';
  @Input({ required: true }) headline = 'Update job';
  @Input({ required: true }) eyebrow = '';
  @Input() payload: EntryModalPayload | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<EntryModalPayload>();
}
