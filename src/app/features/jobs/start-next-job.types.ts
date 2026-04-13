import type {
  EmployeeJobHistoryRecord,
  EmployeeReadinessState,
  EmployeeStartNextJobReadiness,
} from '../employees/employees.types.js';

export type StartNextJobLoadState = 'loading' | 'ready' | 'error';
export type StartNextJobSaveState = 'idle' | 'saving' | 'success' | 'error';
export type StartNextJobDispatchMode = 'start_now' | 'schedule_later';

export interface CrewConflict {
  employeeId: string;
  employeeName: string;
  reason: string;
}

export interface SelectedCrewHistoryItem extends EmployeeJobHistoryRecord {
  employeeName: string;
  linkedClientName?: string | null;
  displayJobLabel?: string;
}

export interface AssignmentDraftValidation {
  readonly isReady: boolean;
  readonly blockingReasons: readonly string[];
}

export interface ReadinessPill {
  readonly text: string;
  readonly state: EmployeeReadinessState;
}

export type OngoingRunState = 'on_schedule' | 'late' | 'early_start';

export interface OngoingRunSnapshot {
  readonly runKey: string;
  readonly primaryEntryId: string;
  readonly assignmentId: string | null;
  readonly displayJobLabel: string;
  readonly address: string;
  readonly scheduledStart: string;
  readonly scheduledEnd: string;
  readonly runStartedAt: string;
  readonly activeCrewCount: number;
  readonly activeCrewNames: readonly string[];
  readonly state: OngoingRunState;
}

export interface AssignmentAnalyticsSnapshot {
  readonly totalTracked: number;
  readonly scheduledCount: number;
  readonly completedCount: number;
  readonly cancelledCount: number;
  readonly completedOnTimeCount: number;
  readonly completedLateCount: number;
  readonly scheduledLateCount: number;
  readonly continuityCount: number;
  readonly totalHours: number;
  readonly averageHours: number;
  readonly completionRate: number;
  readonly cancellationRate: number;
  readonly uniqueSites: number;
}

export interface AssignmentAnalyticsExport {
  readonly filename: string;
  readonly csvContent: string;
  readonly rowCount: number;
}

export interface EmployeeAssignmentTrendSnapshot {
  readonly employeeId: string;
  readonly employeeName: string;
  readonly totalTracked: number;
  readonly scheduledCount: number;
  readonly completedCount: number;
  readonly cancelledCount: number;
  readonly totalHours: number;
  readonly averageHours: number;
  readonly completionRate: number;
  readonly cancellationRate: number;
  readonly lastScheduledStart: string | null;
  readonly lastSiteLabel: string | null;
  readonly lastAddress: string | null;
}

export interface RouteAssignmentVarianceSnapshot {
  readonly routeId: string;
  readonly siteLabel: string;
  readonly address: string;
  readonly totalTracked: number;
  readonly scheduledCount: number;
  readonly completedCount: number;
  readonly cancelledCount: number;
  readonly totalHours: number;
  readonly averageHours: number;
  readonly completionRate: number;
  readonly cancellationRate: number;
  readonly averageHoursVariance: number;
  readonly lastScheduledStart: string | null;
}

export type StartNextJobAnalyticsWindow = '7d' | '30d' | '90d' | 'custom';

export interface CrossRunTrendSnapshot {
  readonly periodStart: string;
  readonly periodLabel: string;
  readonly totalTracked: number;
  readonly completedCount: number;
  readonly cancelledCount: number;
  readonly scheduledCount: number;
  readonly totalHours: number;
  readonly completionRate: number;
  readonly cancellationRate: number;
  readonly hoursShare: number;
}

export type StartNextJobReadinessRecord = EmployeeStartNextJobReadiness;
