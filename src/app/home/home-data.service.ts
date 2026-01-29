import { Injectable } from '@angular/core';
import type {
  ActivityItem,
  AlertItem,
  HeroMetric,
  PayrollEntry,
  QuickAction,
  TrendPoint,
} from './home.models';

@Injectable({ providedIn: 'root' })
export class HomeDataService {
  getHeroMetrics(): HeroMetric[] {
    return [
      { id: 'jobs-today', label: 'Jobs today', value: '4', deltaLabel: '+1 vs avg', trend: 'up' },
      { id: 'gross-today', label: 'Today\'s gross (pre-tax)', value: '$5,240', deltaLabel: '+$320', trend: 'up' },
      { id: 'prf-balance', label: 'PRF balance', value: '$32,410', deltaLabel: 'steady', trend: 'flat' },
      { id: 'charbel-owed', label: 'Charbel owed', value: '$8,150', deltaLabel: '-$450', trend: 'down' },
    ];
  }

  getQuickActions(): QuickAction[] {
    return [
      {
        id: 'new-job',
        label: 'New Job',
        description: 'Start a calculation',
        icon: '?',
        command: 'new-job',
      },
      {
        id: 'undo-job',
        label: 'Undo Last',
        description: 'Reverse previous log',
        icon: '??',
        command: 'undo-job',
      },
      {
        id: 'manage-employees',
        label: 'Manage Employees',
        description: 'Update availability & rates',
        icon: '??',
        command: 'manage-employees',
      },
      {
        id: 'advanced-options',
        label: 'Advanced Options',
        description: 'Adjust calculation rules',
        icon: '??',
        command: 'advanced-options',
      },
    ];
  }

  getRecentJobs(): ActivityItem[] {
    return [
      {
        id: 'job-4821',
        partnerNames: ['Karim', 'Nassif'],
        grossPreTax: 1380,
        timestamp: '2026-01-29T07:45:00Z',
        status: 'logged',
      },
      {
        id: 'job-4820',
        partnerNames: ['Maya'],
        grossPreTax: 850,
        timestamp: '2026-01-29T06:10:00Z',
        status: 'logged',
      },
      {
        id: 'job-4819',
        partnerNames: ['Karim', 'Lea'],
        grossPreTax: 990,
        timestamp: '2026-01-28T21:00:00Z',
        status: 'pending',
      },
    ];
  }

  getAlerts(): AlertItem[] {
    return [
      {
        id: 'alert-1',
        message: 'Commission for Alex raised to 12% by Owner at 08:10',
        severity: 'info',
        timestamp: '2026-01-29T08:10:00Z',
      },
      {
        id: 'alert-2',
        message: 'PRF dipped below target threshold yesterday',
        severity: 'warning',
        timestamp: '2026-01-28T23:00:00Z',
      },
    ];
  }

  getWeeklyPayroll(): PayrollEntry[] {
    return [
      { employee: 'Alex', hours: 28, wages: 980 },
      { employee: 'Sasha', hours: 31, wages: 1_085 },
      { employee: 'Mel', hours: 24, wages: 840 },
    ];
  }

  getPrfTrend(): TrendPoint[] {
    return [
      { label: 'Mon', value: 31800 },
      { label: 'Tue', value: 32210 },
      { label: 'Wed', value: 32480 },
      { label: 'Thu', value: 32750 },
      { label: 'Fri', value: 32410 },
      { label: 'Sat', value: 32600 },
      { label: 'Sun', value: 32410 },
    ];
  }
}
