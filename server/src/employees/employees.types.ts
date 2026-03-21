export type EmployeeRosterStatus = 'active' | 'inactive';

export type EmployeeOperatorRole = 'owner' | 'manager';

export type EmployeeJobStatus = 'scheduled' | 'completed' | 'cancelled';

export type EmployeeReadinessState = 'available' | 'scheduled' | 'inactive';

export type EmployeeHoursSource = 'manual' | 'clock' | 'assignment';

export type EmployeeClockAction = 'clock_in' | 'clock_out';

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
  assignmentId?: string | null;
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

export interface EmployeesSnapshot {
  roster: EmployeeProfileRecord[];
  hours: EmployeeHoursRecord[];
  history: EmployeeJobHistoryRecord[];
}
