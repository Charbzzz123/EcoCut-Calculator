export interface CreateStartNextJobAssignmentDto {
  jobLabel: string;
  address: string;
  scheduledStart: string;
  scheduledEnd: string;
  employeeIds: string[];
}
