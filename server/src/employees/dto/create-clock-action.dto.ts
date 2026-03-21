export interface CreateClockActionDto {
  employeeId: string;
  action: 'clock_in' | 'clock_out';
  siteLabel?: string;
}
