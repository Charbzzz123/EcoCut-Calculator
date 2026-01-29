export type TrendDirection = 'up' | 'down' | 'flat';

export interface HeroMetric {
  id: string;
  label: string;
  value: string;
  deltaLabel?: string;
  trend?: TrendDirection;
}

export type QuickActionCommand = 'new-job' | 'undo-job' | 'manage-employees' | 'advanced-options';

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  command: QuickActionCommand;
}

export interface ActivityItem {
  id: string;
  partnerNames: string[];
  grossPreTax: number;
  timestamp: string;
  status: 'logged' | 'pending' | 'reversed';
}

export interface AlertItem {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'danger';
  timestamp: string;
}

export interface PayrollEntry {
  employee: string;
  hours: number;
  wages: number;
}

export interface TrendPoint {
  label: string;
  value: number;
}
