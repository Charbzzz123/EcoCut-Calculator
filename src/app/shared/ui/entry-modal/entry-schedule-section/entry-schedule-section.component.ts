import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  CalendarSchedulerComponent,
  type CalendarSchedulerHandlers,
  type CalendarSchedulerViewModel,
} from '../../calendar-scheduler/calendar-scheduler.component.js';

export type EntryScheduleSectionViewModel = CalendarSchedulerViewModel;
export type EntryScheduleSectionHandlers = CalendarSchedulerHandlers;

@Component({
  selector: 'app-entry-schedule-section',
  standalone: true,
  imports: [CalendarSchedulerComponent],
  template: `
    <app-calendar-scheduler [viewModel]="viewModel" [handlers]="handlers"></app-calendar-scheduler>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntryScheduleSectionComponent {
  @Input({ required: true }) viewModel!: EntryScheduleSectionViewModel;
  @Input({ required: true }) handlers!: EntryScheduleSectionHandlers;
}
