export interface CreateHoursEntryDto {
  employeeId: string;
  workDate: string;
  siteLabel?: string;
  jobEntryId?: string;
  correctionNote?: string;
  hours: number;
}
