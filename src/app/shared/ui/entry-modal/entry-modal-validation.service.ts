import { Injectable } from '@angular/core';
import type { FormGroup } from '@angular/forms';
import type { HedgeConfig } from '@shared/domain/entry/entry-modal.models.js';

@Injectable({ providedIn: 'root' })
export class EntryModalValidationService {
  validateCalendarRange(calendarGroup: FormGroup, requiresCalendar: boolean): boolean {
    if (!requiresCalendar) {
      return true;
    }
    const { date, startTime, endTime } = calendarGroup.getRawValue();
    if (!date || !startTime || !endTime) {
      calendarGroup.markAllAsTouched();
      return false;
    }
    const startIso = this.combineDateTime(date, startTime);
    const endIso = this.combineDateTime(date, endTime);
    const endControl = calendarGroup.get('endTime');
    if (new Date(startIso).getTime() >= new Date(endIso).getTime()) {
      endControl?.setErrors({ ...(endControl.errors ?? {}), timeOrder: true });
      endControl?.markAsTouched();
      return false;
    }
    if (endControl?.errors?.['timeOrder']) {
      const rest = { ...endControl.errors };
      delete rest['timeOrder'];
      endControl.setErrors(Object.keys(rest).length ? rest : null);
    }
    return true;
  }

  hasSelectedHedge(hedges: Record<string, HedgeConfig>): boolean {
    return Object.values(hedges).some((config) => config?.state && config.state !== 'none');
  }

  private combineDateTime(date: string, time: string): string {
    return new Date(`${date}T${time}`).toISOString();
  }
}
