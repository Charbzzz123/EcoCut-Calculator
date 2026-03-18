import { Injectable } from '@angular/core';
import type { FormGroup } from '@angular/forms';
import type {
  HedgeConfig,
  RabattageConfig,
  TrimConfig,
} from '@shared/domain/entry/entry-modal.models.js';

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

  listIncompleteHedgeConfigs(hedges: Record<string, HedgeConfig>): string[] {
    return Object.entries(hedges).flatMap(([hedgeId, config]) => {
      if (!config || config.state === 'none') {
        return [];
      }

      const label = this.formatHedgeLabel(hedgeId);
      if (config.state === 'trim' && !this.isTrimConfigured(config.trim)) {
        return [`${label}: select at least one trim option or preset.`];
      }
      if (config.state === 'rabattage' && !this.isRabattageConfigured(config.rabattage)) {
        return [`${label}: complete the rabattage option.`];
      }
      return [];
    });
  }

  private combineDateTime(date: string, time: string): string {
    return new Date(`${date}T${time}`).toISOString();
  }

  private isTrimConfigured(trim?: TrimConfig): boolean {
    if (!trim) {
      return false;
    }
    if (trim.mode === 'preset') {
      return !!trim.preset;
    }
    return !!(trim.inside || trim.top || trim.outside);
  }

  private isRabattageConfigured(rabattage?: RabattageConfig): boolean {
    if (!rabattage?.option) {
      return false;
    }
    if (rabattage.option === 'partial') {
      return !!rabattage.partialAmountText?.trim();
    }
    return true;
  }

  private formatHedgeLabel(hedgeId: string): string {
    const parts = hedgeId.split('-');
    const suffix = parts.length > 1 ? parts[1] : hedgeId;
    return `Hedge ${suffix}`;
  }
}
