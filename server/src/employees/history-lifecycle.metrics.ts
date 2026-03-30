import type { EmployeeJobHistoryRecord } from './employees.types';

const TIMING_TOLERANCE_MS = 60_000;

const toTimestamp = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const isContinuityEntry = (entry: EmployeeJobHistoryRecord): boolean =>
  Boolean(
    entry.continuitySourceHistoryEntryId ??
    entry.continuityCategory ??
    entry.continuityReason?.trim(),
  );

const isScheduledLate = (
  entry: EmployeeJobHistoryRecord,
  nowTimestamp: number,
): boolean => {
  if (entry.status !== 'scheduled') {
    return false;
  }
  const scheduledEnd = toTimestamp(entry.scheduledEnd);
  if (scheduledEnd === null) {
    return false;
  }
  return nowTimestamp > scheduledEnd + TIMING_TOLERANCE_MS;
};

const isCompletedLate = (entry: EmployeeJobHistoryRecord): boolean => {
  if (entry.status !== 'completed') {
    return false;
  }
  const scheduledEnd = toTimestamp(entry.scheduledEnd);
  if (scheduledEnd === null) {
    return false;
  }
  const actualEnd = toTimestamp(entry.runEndedAt) ?? scheduledEnd;
  return actualEnd > scheduledEnd + TIMING_TOLERANCE_MS;
};

export interface EmployeeHistoryLifecycleSummary {
  completedOnTime: number;
  completedLate: number;
  scheduledLate: number;
  continuity: number;
}

export const computeHistoryLifecycleSummary = (
  entries: readonly EmployeeJobHistoryRecord[],
  nowIso: string = new Date().toISOString(),
): EmployeeHistoryLifecycleSummary => {
  const nowTimestamp = toTimestamp(nowIso) ?? Date.now();
  let completedOnTime = 0;
  let completedLate = 0;
  let scheduledLate = 0;
  let continuity = 0;

  for (const entry of entries) {
    if (isContinuityEntry(entry)) {
      continuity += 1;
    }
    if (isCompletedLate(entry)) {
      completedLate += 1;
    } else if (entry.status === 'completed') {
      completedOnTime += 1;
    }
    if (isScheduledLate(entry, nowTimestamp)) {
      scheduledLate += 1;
    }
  }

  return {
    completedOnTime,
    completedLate,
    scheduledLate,
    continuity,
  };
};
