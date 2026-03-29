export type EmployeeRosterStatus = 'active' | 'inactive';

export type EmployeeLoadState = 'loading' | 'ready' | 'error';

export type EmployeeStatusFilter = 'all' | EmployeeRosterStatus;

export interface EmployeeRosterRecord {
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

export type EmployeeEditorMode = 'create' | 'edit';

export interface EmployeeProfileDraft {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  role: string;
  hourlyRate: string;
  notes: string;
}

export interface EmployeeProfileMutationPayload {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  role: string;
  hourlyRate: number;
  notes?: string;
}

export type EmployeeOperatorRole = 'owner' | 'manager';
export type EmployeeHoursSource = 'manual' | 'clock' | 'assignment';
export type EmployeeClockAction = 'clock_in' | 'clock_out';

export interface EmployeeLoggedJobOption {
  entryId: string;
  clientName: string;
  siteLabel: string;
  address: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface EmployeeHoursRecord {
  id: string;
  employeeId: string;
  workDate: string;
  siteLabel: string;
  hours: number;
  source: EmployeeHoursSource;
  jobEntryId?: string | null;
  assignmentId?: string | null;
  historyEntryId?: string | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  updatedByRole: EmployeeOperatorRole;
  updatedAt: string;
}

export interface EmployeeClockActionPayload {
  employeeId: string;
  action: EmployeeClockAction;
  siteLabel?: string;
}

export interface EmployeeStartNextJobAssignmentPayload {
  jobLabel: string;
  address: string;
  scheduledStart: string;
  scheduledEnd: string;
  employeeIds: string[];
}

export interface EmployeeScheduledHistoryUpdatePayload {
  siteLabel: string;
  address: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface EmployeeScheduledHistoryReassignPayload {
  employeeId: string;
}

export interface EmployeeStartNextJobAssignmentResult {
  assignmentId: string;
  createdHistory: EmployeeJobHistoryRecord[];
  createdHours: EmployeeHoursRecord[];
}

export interface EmployeeHoursDraft {
  workDate: string;
  jobEntryId: string;
  siteLabel: string;
  hours: string | number;
}

export interface EmployeeHoursMutationPayload {
  employeeId: string;
  workDate: string;
  siteLabel?: string;
  jobEntryId?: string | null;
  hours: number;
}

export type EmployeeJobStatus = 'scheduled' | 'completed' | 'cancelled';

export interface EmployeeJobHistoryRecord {
  id: string;
  employeeId: string;
  siteLabel: string;
  address: string;
  scheduledStart: string;
  scheduledEnd: string;
  hoursWorked: number;
  status: EmployeeJobStatus;
  linkedHoursEntryId?: string | null;
  jobEntryId?: string | null;
  assignmentId?: string | null;
}

export type EmployeeReadinessState = 'available' | 'scheduled' | 'inactive';

export interface EmployeeAvailabilityWindow {
  jobId: string;
  siteLabel: string;
  address: string;
  startAt: string;
  endAt: string;
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
