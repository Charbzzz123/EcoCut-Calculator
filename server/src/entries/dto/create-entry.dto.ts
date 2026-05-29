export type EntryVariant = 'warm-lead' | 'customer';

export type HedgeState = 'none' | 'trim' | 'rabattage';

export interface TrimConfigDto {
  mode: 'custom' | 'preset';
  inside?: boolean;
  top?: boolean;
  outside?: boolean;
  preset?: 'normal' | 'total';
}

export interface RabattageConfigDto {
  option: 'partial' | 'total' | 'total_no_roots';
  partialAmountText?: string;
}

export interface HedgeConfigDto {
  state: HedgeState;
  trim?: TrimConfigDto;
  rabattage?: RabattageConfigDto;
}

export interface EntryCalendarDto {
  start: string;
  end: string;
  timeZone?: string;
  eventId?: string;
}

export interface EntryExecutionCrewMemberDto {
  employeeId: string;
  fullName: string;
  hoursWorked: number;
}

export interface EntryExecutionDto {
  status: 'scheduled' | 'running' | 'completed';
  startedAt?: string | null;
  endedAt?: string | null;
  completionNote?: string | null;
  completedByRole?: 'owner' | 'manager' | null;
  totalHours: number;
  crew: EntryExecutionCrewMemberDto[];
  updatedAt: string;
}

export interface EntryFormDto {
  firstName: string;
  lastName: string;
  address: string;
  phone: string;
  email?: string;
  jobType: string;
  jobValue: string;
  desiredBudget?: string;
  additionalDetails?: string;
}

export interface CreateEntryDto {
  variant: EntryVariant;
  form: EntryFormDto;
  hedges: Record<string, HedgeConfigDto>;
  calendar?: EntryCalendarDto;
  execution?: EntryExecutionDto;
}
