import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { EntryDetailsFormComponent } from './entry-details-form/entry-details-form.component.js';
import { EntryModalFooterComponent } from './entry-footer/entry-modal-footer.component.js';
import { EntryModalFacade } from './entry-modal.facade.js';
import { EntryScheduleSectionComponent } from './entry-schedule-section/entry-schedule-section.component.js';

export { northAmericanPhoneValidator } from './entry-modal-phone.util.js';
export type { CalendarSlot, TimelineEventBlock } from './entry-modal-schedule.controller.js';

@Component({
  selector: 'app-entry-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    EntryDetailsFormComponent,
    EntryScheduleSectionComponent,
    EntryModalFooterComponent,
  ],
  templateUrl: './entry-modal.component.html',
  styleUrl: './entry-modal.component.scss',
})
export class EntryModalComponent extends EntryModalFacade {}
