import type { EmployeeContinuityCategory } from '../employees.types';

export interface CreateStartNextJobAssignmentDto {
  jobLabel: string;
  address: string;
  scheduledStart: string;
  scheduledEnd: string;
  employeeIds: string[];
  jobEntryId?: string | null;
  continuityCategory?: EmployeeContinuityCategory | null;
  continuityReason?: string | null;
}
