import type { EntryModalPayload, HedgeState } from './entry-modal.models.js';
import { buildCalendarEventRequest } from './calendar-event.builder.js';

describe('buildCalendarEventRequest', () => {
  const basePayload: EntryModalPayload = {
    variant: 'customer',
    form: {
      firstName: 'Adlane',
      lastName: 'Marco',
      address: '123 Cedar Lane',
      phone: '(438) 123-4567',
      jobType: 'Hedge Trimming',
      jobValue: '950',
    },
    hedges: {
      'hedge-1': { state: 'trim', trim: { mode: 'custom', inside: true, top: true } },
      'hedge-2': { state: 'rabattage', rabattage: { option: 'partial', partialAmountText: '4 ft off top' } },
      'hedge-3': { state: 'none' },
      'hedge-4': { state: 'none' },
      'hedge-5': { state: 'none' },
      'hedge-6': { state: 'none' },
      'hedge-7': { state: 'none' },
      'hedge-8': { state: 'none' },
    },
    calendar: {
      start: '2026-03-10T14:00:00Z',
      end: '2026-03-10T15:00:00Z',
      timeZone: 'America/Toronto',
      notes: 'Bring extra bags',
    },
  };

  it('returns null when no calendar payload is present', () => {
    const payload: EntryModalPayload = { ...basePayload, calendar: undefined };
    expect(buildCalendarEventRequest(payload)).toBeNull();
  });

  it('builds a descriptive calendar request from entry payload', () => {
    const request = buildCalendarEventRequest(basePayload);
    expect(request).not.toBeNull();
    expect(request?.summary).toContain('Adlane Marco');
    expect(request?.location).toBe('123 Cedar Lane');
    expect(request?.description).toContain('Front walkway (left) Trim (Inside + Top)');
    expect(request?.description).toContain('Left perimeter Rabattage');
    expect(request?.description).toContain('Job value:');
    expect(request?.description).toContain('Calendar notes: Bring extra bags');
  });

  it('summarizes presets and total-without-roots rabattage selections', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      hedges: {
        'hedge-1': { state: 'trim', trim: { mode: 'preset', preset: 'total' } },
        'hedge-2': { state: 'rabattage', rabattage: { option: 'total_no_roots' } },
        'hedge-3': { state: 'none' },
        'hedge-4': { state: 'none' },
        'hedge-5': { state: 'none' },
        'hedge-6': { state: 'none' },
        'hedge-7': { state: 'none' },
        'hedge-8': { state: 'none' },
      },
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('Total preset');
    expect(request?.description).toContain('Total without roots');
  });

  it('includes optional fields and fallback hedge descriptions', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      form: {
        ...basePayload.form,
        desiredBudget: '800',
        additionalDetails: 'Edge driveway and bag debris',
      },
      hedges: {
        'hedge-1': { state: 'trim', trim: undefined },
        'hedge-2': { state: 'rabattage', rabattage: undefined },
        'hedge-3': { state: 'rabattage', rabattage: { option: 'total' } },
        'hedge-4': { state: 'none' },
        'hedge-5': { state: 'none' },
        'hedge-6': { state: 'none' },
        'hedge-7': { state: 'none' },
        'hedge-8': { state: 'none' },
      },
      calendar: { ...basePayload.calendar! },
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('Desired budget:');
    expect(request?.description).toContain('Additional details: Edge driveway and bag debris');
    expect(request?.description).toContain('Front walkway (left) Trim (custom)');
    expect(request?.description).toContain('Left perimeter Rabattage (Total)');
    expect(request?.description).toContain('(Total)');
  });

  it('falls back to custom/preset descriptions when details missing', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      hedges: {
        'hedge-1': { state: 'trim', trim: { mode: 'custom', inside: false, top: false, outside: false } },
        'hedge-2': { state: 'rabattage', rabattage: { option: 'total' } },
        'hedge-3': { state: 'none' },
        'hedge-4': { state: 'none' },
        'hedge-5': { state: 'none' },
        'hedge-6': { state: 'none' },
        'hedge-7': { state: 'none' },
        'hedge-8': { state: 'none' },
      },
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('(custom)');
    expect(request?.description).toContain('(Total)');
  });

  it('handles missing hedge configs gracefully', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      hedges: {
        'hedge-1': { state: 'trim' },
        'hedge-2': { state: 'rabattage' },
        'hedge-3': { state: 'none' },
        'hedge-4': { state: 'none' },
        'hedge-5': { state: 'none' },
        'hedge-6': { state: 'none' },
        'hedge-7': { state: 'none' },
        'hedge-8': { state: 'none' },
      },
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('(custom)');
    expect(request?.description).toContain('(Total)');
  });

  it('omits calendar notes when none are provided', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      calendar: { ...basePayload.calendar!, notes: undefined },
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).not.toContain('Calendar notes');
  });

  it('describes unknown hedge states for forward compatibility', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      hedges: {
        ...basePayload.hedges,
        'hedge-4': { state: 'future' as HedgeState },
      },
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('Right perimeter (future)');
  });

  it('formats invalid job values to zero dollars', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      form: { ...basePayload.form, jobValue: 'not-a-number' },
      calendar: { ...basePayload.calendar!, notes: '' },
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('Job value: $0.00');
    expect(request?.description).not.toContain('Calendar notes:');
  });
});
