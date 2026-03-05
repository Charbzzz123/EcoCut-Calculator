import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-clients-toolbar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './clients-toolbar.component.html',
  styleUrl: './clients-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsToolbarComponent {
  @Input({ required: true }) queryControl!: FormControl<string>;
  @Output() refresh = new EventEmitter<void>();
}
