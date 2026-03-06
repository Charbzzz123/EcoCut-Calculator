import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterModule } from '@angular/router';

type RouterTarget = string | readonly unknown[];

@Component({
  selector: 'app-back-chip',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './back-chip.component.html',
  styleUrl: './back-chip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackChipComponent {
  @Input() label = 'Back to dashboard';
  @Input() icon = '↩';
  @Input() ariaLabel?: string;
  @Input() routerLink?: RouterTarget;
  @Output() back = new EventEmitter<void>();

  protected emitBack(): void {
    this.back.emit();
  }

  protected get computedAriaLabel(): string {
    return this.ariaLabel ?? this.label;
  }
}
