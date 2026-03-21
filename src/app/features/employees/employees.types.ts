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

export type EmployeeOperatorRole = 'owner' | 'manager';

export interface EmployeeHoursRecord {
  id: string;
  employeeId: string;
  workDate: string;
  siteLabel: string;
  hours: number;
  updatedByRole: EmployeeOperatorRole;
  updatedAt: string;
}

export interface EmployeeHoursDraft {
  workDate: string;
  siteLabel: string;
  hours: string;
}

export type EmployeeJobStatus = 'scheduled' | 'completed';

export interface EmployeeJobHistoryRecord {
  id: string;
  employeeId: string;
  siteLabel: string;
  address: string;
  scheduledStart: string;
  scheduledEnd: string;
  hoursWorked: number;
  status: EmployeeJobStatus;
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
