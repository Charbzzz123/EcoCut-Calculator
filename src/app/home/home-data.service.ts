import { Injectable } from '@angular/core';
import type { EntryModalPayload } from './models/entry-modal.models.js';
import type { HeroMetric, QuickAction, WeeklyHourSummary } from './home.models.js';

@Injectable({ providedIn: 'root' })
export class HomeDataService {
  getHeroMetrics(): HeroMetric[] {
    return [
      { id: 'jobs-today', label: 'Jobs today', value: '4', deltaLabel: '+1 vs avg', trend: 'up' },
      {
        id: 'gross-today',
        label: "Today's gross (pre-tax)",
        value: '$5,240',
        deltaLabel: '+$320',
        trend: 'up',
      },
      {
        id: 'prf-balance',
        label: 'PRF balance',
        value: '$32,410',
        deltaLabel: 'steady',
        trend: 'flat',
      },
      {
        id: 'charbel-owed',
        label: 'Charbel owed',
        value: '$8,150',
        deltaLabel: '-$450',
        trend: 'down',
      },
    ];
  }

  getQuickActions(): QuickAction[] {
    return [
      {
        id: 'new-job',
        label: 'Add Job',
        description: 'Log a new job',
        icon: '\u2795',
        command: 'new-job',
      },
      {
        id: 'start-next-job',
        label: 'Start Next Job',
        description: 'Resume the next queued job',
        icon: '\u25B6\uFE0F',
        command: 'start-next-job',
      },
      {
        id: 'undo-job',
        label: 'Undo Last',
        description: 'Reverse previous log',
        icon: '\u21A9\uFE0F',
        command: 'undo-job',
      },
      {
        id: 'manage-employees',
        label: 'Manage Employees',
        description: 'Update availability & rates',
        icon: '\u{1F527}',
        command: 'manage-employees',
      },
      {
        id: 'employee-directory',
        label: 'Employee List',
        description: 'View roster & contacts',
        icon: '\u{1F465}',
        command: 'view-employee-directory',
      },
      {
        id: 'clients',
        label: 'Clients',
        description: 'Review client accounts',
        icon: '\u{1F4D8}',
        command: 'view-clients',
      },
      {
        id: 'schedule',
        label: 'Schedule',
        description: 'See upcoming work',
        icon: '\u{1F5D3}\uFE0F',
        command: 'view-schedule',
      },
      {
        id: 'finances',
        label: 'Finances',
        description: 'Check cashflow & funds',
        icon: '\u{1F4B2}',
        command: 'view-finances',
      },
      {
        id: 'upcoming-pay',
        label: 'Upcoming Pay',
        description: 'Preview payroll obligations',
        icon: '\u{1F4B8}',
        command: 'view-upcoming-pay',
      },
      {
        id: 'performance',
        label: 'Performance Stats',
        description: 'Trend dashboards & KPIs',
        icon: '\u{1F4AA}',
        command: 'view-performance',
      },
      {
        id: 'broadcast',
        label: 'Client Broadcast',
        description: 'Send announcement to all clients',
        icon: '\u{1F4AC}',
        command: 'broadcast-clients',
      },
      {
        id: 'advanced-options',
        label: 'Advanced Options',
        description: 'Adjust calculation rules',
        icon: '\u2699\uFE0F',
        command: 'advanced-options',
      },
    ];
  }

  getWeeklyHourSummaries(): WeeklyHourSummary[] {
    return [
      { id: 'emp-karam', employee: 'Karam', hours: '32h', role: 'Lead tech', amount: '$1,240' },
      { id: 'emp-nassif', employee: 'Nassif', hours: '28h', role: 'Crew', amount: '$1,010' },
      { id: 'emp-adlane', employee: 'Adlane', hours: '24h', role: 'Crew', amount: '$870' },
      { id: 'emp-marco', employee: 'Marco', hours: '18h', role: 'Support', amount: '$620' },
    ];
  }

  async saveEntry(payload: EntryModalPayload): Promise<void> {
    console.info('Simulating entry persistence', payload);
  }
}
