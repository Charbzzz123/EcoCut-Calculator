import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HomeDataService } from './home-data.service';
import type {
  ActivityItem,
  AlertItem,
  HeroMetric,
  PayrollEntry,
  QuickAction,
  QuickActionCommand,
  TrendPoint,
} from './home.models';

@Injectable()
export class HomeFacade {
  private readonly data = inject(HomeDataService);
  private readonly router = inject(Router);

  readonly heroMetrics = signal<HeroMetric[]>(this.data.getHeroMetrics());
  readonly quickActions = signal<QuickAction[]>(this.data.getQuickActions());
  readonly recentJobs = signal<ActivityItem[]>(this.data.getRecentJobs());
  readonly alerts = signal<AlertItem[]>(this.data.getAlerts());
  readonly weeklyPayroll = signal<PayrollEntry[]>(this.data.getWeeklyPayroll());
  readonly prfTrend = signal<TrendPoint[]>(this.data.getPrfTrend());

  readonly hasAlerts = computed(() => this.alerts().length > 0);

  startNewJob(): void {
    this.navigateWhenReady('/jobs/new');
  }

  undoLastEntry(): void {
    console.info('Undo last entry triggered');
  }

  openManageEmployees(): void {
    this.navigateWhenReady('/admin/employees');
  }

  openAdvancedOptions(): void {
    this.navigateWhenReady('/admin/advanced');
  }

  handleQuickAction(command: QuickActionCommand): void {
    switch (command) {
      case 'new-job':
        this.startNewJob();
        break;
      case 'undo-job':
        this.undoLastEntry();
        break;
      case 'manage-employees':
        this.openManageEmployees();
        break;
      case 'advanced-options':
        this.openAdvancedOptions();
        break;
      default:
        console.warn('Unhandled quick action', command);
    }
  }

  private navigateWhenReady(url: string): void {
    // Placeholder navigation until routes are wired up.
    void this.router.navigateByUrl(url).catch(() => {
      console.info(`Navigation target "${url}" is not ready yet.`);
    });
  }
}
