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
  status: EmployeeRosterStatus;
  lastActivityAt: string | null;
}
