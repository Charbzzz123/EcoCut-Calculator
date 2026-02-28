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
