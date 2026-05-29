export type TrendDirection = 'up' | 'down' | 'flat';

export interface HeroMetric {
  id: string;
  label: string;
  value: string;
  deltaLabel?: string;
  trend?: TrendDirection;
}

export type QuickActionCommand =
  | 'new-job'
  | 'undo-job'
  | 'manage-employees'
  | 'advanced-options'
  | 'view-clients'
  | 'view-schedule'
  | 'view-employee-directory'
  | 'view-finances'
  | 'view-upcoming-pay'
  | 'start-next-job'
  | 'view-performance'
  | 'broadcast-clients'
  | 'open-chats';

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  command: QuickActionCommand;
}

export interface WeeklyHourSummary {
  id: string;
  employee: string;
  hours: string;
  amount: string;
  role?: string;
}


