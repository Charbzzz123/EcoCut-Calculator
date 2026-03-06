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
    },
  };

  it('returns null when no calendar payload is present', () => {
    const payload: EntryModalPayload = { ...basePayload, calendar: undefined };
    expect(buildCalendarEventRequest(payload)).toBeNull();
  });

  it('builds a descriptive calendar request from entry payload', () => {
    const request = buildCalendarEventRequest(basePayload);
    expect(request).not.toBeNull();
    expect(request?.summary).toBe('Adlane Marco – Both');
    expect(request?.location).toBe('123 Cedar Lane');
    expect(request?.description).toContain('Address : 123 Cedar Lane');
    expect(request?.description).toContain('Phone : (438) 123-4567');
    expect(request?.description).toContain('Front Left Trim (i,t)');
    expect(request?.description).toContain('Left Rabattage P: 4 ft off top');
    expect(request?.description).toContain('Job value: $950.00');
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
    expect(request?.description).toContain('Front Left Trim T');
    expect(request?.description).toContain('Left Rabattage TnoRoots');
  });

  it('uses the N code when the normal preset is selected', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      hedges: {
        'hedge-2': { state: 'trim', trim: { mode: 'preset', preset: 'normal' } },
      } as EntryModalPayload['hedges'],
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('Left Trim N');
  });

  it('falls back to custom text when preset mode lacks a preset value', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      hedges: {
        'hedge-2': { state: 'trim', trim: { mode: 'preset' } },
      } as EntryModalPayload['hedges'],
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('Left Trim (custom)');
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
    expect(request?.description).toContain('Front Left Trim (custom)');
    expect(request?.description).toContain('Left Rabattage T');
    expect(request?.description).toContain('Back Rabattage T');
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
    expect(request?.description).toContain('Front Left Trim (custom)');
    expect(request?.description).toContain('Left Rabattage T');
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
    expect(request?.description).toContain('Front Left Trim (custom)');
    expect(request?.description).toContain('Left Rabattage T');
  });

  it('omits the hedge plan header when no hedges are selected', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      hedges: {
        'hedge-1': { state: 'none' },
        'hedge-2': { state: 'none' },
        'hedge-3': { state: 'none' },
        'hedge-4': { state: 'none' },
        'hedge-5': { state: 'none' },
        'hedge-6': { state: 'none' },
        'hedge-7': { state: 'none' },
        'hedge-8': { state: 'none' },
      },
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).not.toContain('Hedge plan:');
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
    expect(request?.description).toContain('Right (future)');
  });

  it('summarizes partial rabattage even when no amount text is provided', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      hedges: {
        ...basePayload.hedges,
        'hedge-2': { state: 'rabattage', rabattage: { option: 'partial', partialAmountText: '' } },
      },
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('Left Rabattage P');
  });

  it('falls back to the hedge id when the label mapping is missing', () => {
    type HedgeConfigMap = EntryModalPayload['hedges'];
    const payload: EntryModalPayload = {
      ...basePayload,
      hedges: {
        ...basePayload.hedges,
        ...( { 'hedge-extra': { state: 'trim', trim: { mode: 'custom', inside: true } } } as Record<
          string,
          HedgeConfigMap[keyof HedgeConfigMap]
        >),
      } as HedgeConfigMap,
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('hedge-extra');
  });

  it('merges front hedges when both sides share the same trim selection', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      hedges: {
        'hedge-1': { state: 'trim', trim: { mode: 'custom', inside: true } },
        'hedge-7': { state: 'trim', trim: { mode: 'custom', outside: true } },
      } as EntryModalPayload['hedges'],
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('Front Trim (i,o)');
    expect(request?.description).not.toContain('Front Left Trim');
    expect(request?.description).not.toContain('Front Right Trim');
  });

  it('merges front hedges for rabattage selections too', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      hedges: {
        'hedge-1': { state: 'rabattage', rabattage: { option: 'partial', partialAmountText: '2 ft' } },
        'hedge-7': { state: 'rabattage', rabattage: { option: 'partial' } },
      } as EntryModalPayload['hedges'],
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('Front Rabattage P: 2 ft');
    expect(request?.description).not.toContain('Front Left Rabattage');
    expect(request?.description).not.toContain('Front Right Rabattage');
  });

  it('returns the same descriptor when front trim selections match exactly', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      hedges: {
        'hedge-1': { state: 'trim', trim: { mode: 'custom', inside: true } },
        'hedge-7': { state: 'trim', trim: { mode: 'custom', inside: true } },
      } as EntryModalPayload['hedges'],
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('Front Trim (i)');
  });

  it('falls back to the first descriptor when front trim presets differ', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      hedges: {
        'hedge-1': { state: 'trim', trim: { mode: 'preset', preset: 'normal' } },
        'hedge-7': { state: 'trim', trim: { mode: 'preset', preset: 'total' } },
      } as EntryModalPayload['hedges'],
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('Front Trim N');
  });

  it('falls back to the first rabattage descriptor when the pair is missing details', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      hedges: {
        'hedge-1': { state: 'rabattage', rabattage: { option: 'partial', partialAmountText: '6 ft' } },
        'hedge-7': { state: 'rabattage' },
      } as EntryModalPayload['hedges'],
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('Front Rabattage P: 6 ft');
  });

  it('returns the same rabattage descriptor when both sides match', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      hedges: {
        'hedge-1': { state: 'rabattage', rabattage: { option: 'partial', partialAmountText: '2 ft' } },
        'hedge-7': { state: 'rabattage', rabattage: { option: 'partial', partialAmountText: '2 ft' } },
      } as EntryModalPayload['hedges'],
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('Front Rabattage P: 2 ft');
  });

  it('keeps the original descriptor when both custom trim selections have no tags', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      hedges: {
        'hedge-1': { state: 'trim', trim: { mode: 'custom' } },
        'hedge-7': { state: 'trim', trim: { mode: 'custom' } },
      } as EntryModalPayload['hedges'],
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('Front Trim (custom)');
  });

  it('formats numeric job values without coercion to string', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      form: { ...basePayload.form, jobValue: 1950 as unknown as string },
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('Job value: $1,950.00');
  });

  it('treats blank job values as zero dollars', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      form: { ...basePayload.form, jobValue: '' },
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('Job value: $0.00');
  });

  it('formats invalid job values to zero dollars', () => {
    const payload: EntryModalPayload = {
      ...basePayload,
      form: { ...basePayload.form, jobValue: 'not-a-number' },
    };
    const request = buildCalendarEventRequest(payload);
    expect(request?.description).toContain('Job value: $0.00');
  });
});
