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
export class EntryEditorOverlayComponent implements OnDestroy {
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly closing = signal(false);

  @Input({ required: true }) open = false;
  @Input({ required: true }) variant: EntryVariant = 'warm-lead';
  @Input({ required: true }) headline = 'Update job';
  @Input({ required: true }) eyebrow = '';
  @Input() payload: EntryModalPayload | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<EntryModalPayload>();

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
