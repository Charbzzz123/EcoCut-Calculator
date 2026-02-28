import { Injectable } from '@angular/core';
import type { HeroMetric, QuickAction } from './home.models.js';

@Injectable({ providedIn: 'root' })
export class HomeDataService {
  getHeroMetrics(): HeroMetric[] {
    return [
      { id: 'jobs-today', label: 'Jobs today', value: '4', deltaLabel: '+1 vs avg', trend: 'up' },
      { id: 'gross-today', label: "Today's gross (pre-tax)", value: '$5,240', deltaLabel: '+$320', trend: 'up' },
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
        icon: '➕',
        command: 'new-job',
      },
      {
        id: 'undo-job',
        label: 'Undo Last',
        description: 'Reverse previous log',
        icon: '↺',
        command: 'undo-job',
      },
      {
        id: 'manage-employees',
        label: 'Manage Employees',
        description: 'Update availability & rates',
        icon: '👥',
        command: 'manage-employees',
      },
      {
        id: 'advanced-options',
        label: 'Advanced Options',
        description: 'Adjust calculation rules',
        icon: '⚙️',
        command: 'advanced-options',
      },
    ];
  }
}
