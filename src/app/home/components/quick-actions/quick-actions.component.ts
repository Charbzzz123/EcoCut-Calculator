import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { QuickAction, QuickActionCommand } from '../../home.models';

@Component({
  selector: 'app-quick-actions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quick-actions.component.html',
  styleUrl: './quick-actions.component.scss',
})
export class QuickActionsComponent {
  @Input() actions: QuickAction[] | null = [];
  @Output() actionSelected = new EventEmitter<QuickActionCommand>();

  protected trigger(action: QuickAction): void {
    this.actionSelected.emit(action.command);
  }
}
