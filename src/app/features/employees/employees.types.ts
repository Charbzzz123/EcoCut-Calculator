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
