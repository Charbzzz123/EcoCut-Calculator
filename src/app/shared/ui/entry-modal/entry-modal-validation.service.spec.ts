import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import type { HedgeConfig } from '@shared/domain/entry/entry-modal.models.js';
import { EntryModalValidationService } from './entry-modal-validation.service.js';

describe('EntryModalValidationService', () => {
  let service: EntryModalValidationService;
  const fb = new FormBuilder();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EntryModalValidationService],
    });
    service = TestBed.inject(EntryModalValidationService);
  });

  it('validates calendar ranges', () => {
    const group = fb.group({
      date: ['2026-03-05'],
      startTime: ['08:00'],
      endTime: ['09:00'],
    });
    expect(service.validateCalendarRange(group, true)).toBe(true);

    group.patchValue({ endTime: '07:00' });
    expect(service.validateCalendarRange(group, true)).toBe(false);
    expect(group.controls['endTime'].errors?.['timeOrder']).toBeTruthy();

    group.patchValue({ endTime: '09:30' });
    expect(service.validateCalendarRange(group, true)).toBe(true);
    expect(group.controls['endTime'].errors).toBeNull();
  });

  it('skips validation when calendar is optional', () => {
    const group = fb.group({
      date: [''],
      startTime: [''],
      endTime: [''],
    });
    expect(service.validateCalendarRange(group, false)).toBe(true);
  });

  it('detects selected hedges', () => {
    const hedges: Record<string, HedgeConfig> = {
      a: { state: 'trim', trim: { mode: 'custom', inside: true, top: false, outside: false } },
      b: { state: 'none' },
    };
    expect(service.hasSelectedHedge(hedges)).toBeTruthy();
    hedges['a'] = { state: 'none' };
    expect(service.hasSelectedHedge(hedges)).toBeFalsy();
  });

  it('reports incomplete hedge configurations', () => {
    const hedges: Record<string, HedgeConfig> = {
      'hedge-1': { state: 'trim' },
      'hedge-2': { state: 'trim', trim: { mode: 'preset', preset: 'normal' } },
      'hedge-3': { state: 'rabattage', rabattage: { option: 'partial', partialAmountText: '' } },
      'hedge-4': { state: 'rabattage', rabattage: { option: 'total' } },
      'hedge-5': { state: 'none' },
      'hedge-6': { state: 'rabattage', rabattage: {} as unknown as HedgeConfig['rabattage'] },
    };

    expect(service.listIncompleteHedgeConfigs(hedges)).toEqual([
      'Hedge 1: select at least one trim option or preset.',
      'Hedge 3: complete the rabattage option.',
      'Hedge 6: complete the rabattage option.',
    ]);
  });

  it('accepts configured custom trim hedges and labels unknown ids safely', () => {
    const hedges: Record<string, HedgeConfig> = {
      north: { state: 'trim', trim: { mode: 'custom', outside: true } },
      'hedge-8': { state: 'trim', trim: { mode: 'custom', top: false, inside: false, outside: false } },
    };

    expect(service.listIncompleteHedgeConfigs(hedges)).toEqual([
      'Hedge 8: select at least one trim option or preset.',
    ]);
  });
});
