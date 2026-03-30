import { describe, expect, it } from 'vitest';
import { computeHistoryLifecycleSummary } from './history-lifecycle-metrics.js';
import type { EmployeeJobHistoryRecord } from '../../../features/employees/employees.types.js';

const buildEntry = (
  partial: Partial<EmployeeJobHistoryRecord>,
): EmployeeJobHistoryRecord => ({
  id: 'entry-1',
  employeeId: 'emp-1',
  siteLabel: 'Site',
  address: 'Address',
  scheduledStart: '2026-03-20T09:00:00.000Z',
  scheduledEnd: '2026-03-20T10:00:00.000Z',
  hoursWorked: 1,
  status: 'scheduled',
  ...partial,
});

describe('computeHistoryLifecycleSummary', () => {
  it('counts completed on-time and late entries', () => {
    const summary = computeHistoryLifecycleSummary(
      [
        buildEntry({
          id: 'on-time',
          status: 'completed',
          runEndedAt: '2026-03-20T10:00:30.000Z',
        }),
        buildEntry({
          id: 'late',
          status: 'completed',
          runEndedAt: '2026-03-20T10:05:00.000Z',
        }),
      ],
      '2026-03-25T12:00:00.000Z',
    );

    expect(summary).toEqual({
      completedOnTime: 1,
      completedLate: 1,
      scheduledLate: 0,
      continuity: 0,
    });
  });

  it('counts scheduled late entries and continuity segments', () => {
    const summary = computeHistoryLifecycleSummary(
      [
        buildEntry({
          id: 'scheduled-late',
          status: 'scheduled',
          scheduledEnd: '2026-03-19T10:00:00.000Z',
        }),
        buildEntry({
          id: 'continuity',
          status: 'completed',
          continuityCategory: 'issue_return',
          continuityReason: 'Client requested touch-up',
        }),
      ],
      '2026-03-25T12:00:00.000Z',
    );

    expect(summary).toEqual({
      completedOnTime: 1,
      completedLate: 0,
      scheduledLate: 1,
      continuity: 1,
    });
  });
});
