export interface UpdateHoursEntryDto {
  workDate?: string;
  siteLabel?: string;
  jobEntryId?: string | null;
  correctionNote?: string;
  hours?: number;
}
