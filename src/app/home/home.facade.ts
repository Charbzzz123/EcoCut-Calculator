import { Injectable, inject, type Signal, type WritableSignal } from '@angular/core';
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
import { createWritableSignal } from '../shared/utils/signals';

@Injectable()
export class HomeFacade {
  private readonly data = inject(HomeDataService);
  private readonly router = inject(Router);

  private heroMetricsSignal!: WritableSignal<HeroMetric[]>;
  private quickActionsSignal!: WritableSignal<QuickAction[]>;
  private recentJobsSignal!: WritableSignal<ActivityItem[]>;
  private alertsSignal!: WritableSignal<AlertItem[]>;
  private weeklyPayrollSignal!: WritableSignal<PayrollEntry[]>;
  private prfTrendSignal!: WritableSignal<TrendPoint[]>;

  readonly heroMetrics!: Signal<HeroMetric[]>;
  readonly quickActions!: Signal<QuickAction[]>;
  readonly recentJobs!: Signal<ActivityItem[]>;
  readonly alerts!: Signal<AlertItem[]>;
  readonly weeklyPayroll!: Signal<PayrollEntry[]>;
  readonly prfTrend!: Signal<TrendPoint[]>;

  constructor() {
    this.heroMetricsSignal = createWritableSignal<HeroMetric[]>([]);
    this.quickActionsSignal = createWritableSignal<QuickAction[]>([]);
    this.recentJobsSignal = createWritableSignal<ActivityItem[]>([]);
    this.alertsSignal = createWritableSignal<AlertItem[]>([]);
    this.weeklyPayrollSignal = createWritableSignal<PayrollEntry[]>([]);
    this.prfTrendSignal = createWritableSignal<TrendPoint[]>([]);

    this.heroMetrics = this.heroMetricsSignal.asReadonly();
    this.quickActions = this.quickActionsSignal.asReadonly();
    this.recentJobs = this.recentJobsSignal.asReadonly();
    this.alerts = this.alertsSignal.asReadonly();
    this.weeklyPayroll = this.weeklyPayrollSignal.asReadonly();
    this.prfTrend = this.prfTrendSignal.asReadonly();

    this.hydrateSnapshot();
  }

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

  hasAlerts(): boolean {
    return this.alertsSignal().length > 0;
  }

  updateAlerts(alerts: AlertItem[]): void {
    this.alertsSignal.set(alerts);
  }

  private hydrateSnapshot(): void {
    this.heroMetricsSignal.set(this.data.getHeroMetrics());
    this.quickActionsSignal.set(this.data.getQuickActions());
    this.recentJobsSignal.set(this.data.getRecentJobs());
    this.alertsSignal.set(this.data.getAlerts());
    this.weeklyPayrollSignal.set(this.data.getWeeklyPayroll());
    this.prfTrendSignal.set(this.data.getPrfTrend());
  }

  private navigateWhenReady(url: string): void {
    // Placeholder navigation until routes are wired up.
    void this.router.navigateByUrl(url).catch(() => {
      console.info(`Navigation target "${url}" is not ready yet.`);
    });
  }
}
