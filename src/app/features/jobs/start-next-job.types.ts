import type {
  EmployeeJobHistoryRecord,
  EmployeeReadinessState,
  EmployeeStartNextJobReadiness,
} from '../employees/employees.types.js';

export type StartNextJobLoadState = 'loading' | 'ready' | 'error';
export type StartNextJobSaveState = 'idle' | 'saving' | 'success' | 'error';

export interface CrewConflict {
  employeeId: string;
  employeeName: string;
  reason: string;
}

export interface SelectedCrewHistoryItem extends EmployeeJobHistoryRecord {
  employeeName: string;
}

export interface AssignmentDraftValidation {
  readonly isReady: boolean;
  readonly blockingReasons: readonly string[];
}

export interface ReadinessPill {
  readonly text: string;
  readonly state: EmployeeReadinessState;
}

export type StartNextJobReadinessRecord = EmployeeStartNextJobReadiness;
