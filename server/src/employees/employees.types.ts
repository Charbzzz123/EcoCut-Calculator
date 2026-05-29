export type EmployeeRosterStatus = 'active' | 'inactive';

export type EmployeeOperatorRole = 'owner' | 'manager';

export type EmployeeJobStatus = 'scheduled' | 'completed' | 'cancelled';

export type EmployeeReadinessState = 'available' | 'scheduled' | 'inactive';

export type EmployeeHoursSource = 'manual' | 'clock' | 'assignment';

export type EmployeeClockAction = 'clock_in' | 'clock_out';
export type EmployeeLoggedJobStatus = 'scheduled' | 'late' | 'completed';
export type EmployeeContinuityCategory =
  | 'issue_return'
  | 'touch_up'
  | 'client_change'
  | 'weather_delay'
  | 'access_issue'
  | 'other';

export interface EmployeeLoggedJobOption {
  entryId: string;
  clientName: string;
  siteLabel: string;
  address: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: EmployeeLoggedJobStatus;
}

export interface EmployeeProfileRecord {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: string;
  hourlyRate: number;
  notes: string;
  status: EmployeeRosterStatus;
  lastActivityAt: string | null;
}

export interface EmployeeHoursRecord {
  id: string;
  employeeId: string;
  workDate: string;
  siteLabel: string;
  hours: number;
  source: EmployeeHoursSource;
  jobEntryId?: string | null;
  correctionNote?: string | null;
  assignmentId?: string | null;
  historyEntryId?: string | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  updatedByRole: EmployeeOperatorRole;
  updatedAt: string;
}

export interface EmployeeJobHistoryRecord {
  id: string;
  employeeId: string;
  siteLabel: string;
  address: string;
  scheduledStart: string;
  scheduledEnd: string;
  hoursWorked: number;
  status: EmployeeJobStatus;
  runStartedAt?: string | null;
  runEndedAt?: string | null;
  runClockOutReason?: string | null;
  continuitySourceHistoryEntryId?: string | null;
  continuityCategory?: EmployeeContinuityCategory | null;
  continuityReason?: string | null;
  linkedHoursEntryId?: string | null;
  jobEntryId?: string | null;
  assignmentId?: string | null;
}

export interface EmployeeAssignmentRunLifecycleResult {
  assignmentId: string;
  runStartedAt: string | null;
  runEndedAt: string | null;
  updatedHistory: EmployeeJobHistoryRecord[];
  updatedHours: EmployeeHoursRecord[];
}

export interface EmployeeAvailabilityWindow {
  jobId: string;
  siteLabel: string;
  address: string;
  startAt: string;
  endAt: string;
}

export interface EmployeeStartNextJobAssignmentResult {
  assignmentId: string;
  createdHistory: EmployeeJobHistoryRecord[];
  createdHours: EmployeeHoursRecord[];
}

export interface EmployeeStartNextJobReadiness {
  employeeId: string;
  fullName: string;
  status: EmployeeRosterStatus;
  readinessState: EmployeeReadinessState;
  scheduledJobsCount: number;
  completedJobsCount: number;
  scheduledHours: number;
  completedHours: number;
  nextScheduledStart: string | null;
  nextScheduledEnd: string | null;
  nextAvailableAt: string | null;
  lastCompletedAt: string | null;
  lastCompletedSite: string | null;
  hasScheduleConflict: boolean;
  upcomingWindows: EmployeeAvailabilityWindow[];
}

export interface EmployeeLifecycleReportWindow {
  from: string | null;
  to: string | null;
}

export interface EmployeeLifecycleReportRow {
  employeeId: string;
  fullName: string;
  completedOnTime: number;
  completedLate: number;
  scheduledLate: number;
  continuity: number;
  totalTracked: number;
}

export interface EmployeeLifecycleReport {
  generatedAt: string;
  window: EmployeeLifecycleReportWindow;
  totals: {
    completedOnTime: number;
    completedLate: number;
    scheduledLate: number;
    continuity: number;
    totalTracked: number;
  };
  perEmployee: EmployeeLifecycleReportRow[];
}

export interface EmployeesSnapshot {
  roster: EmployeeProfileRecord[];
  hours: EmployeeHoursRecord[];
  history: EmployeeJobHistoryRecord[];
}
