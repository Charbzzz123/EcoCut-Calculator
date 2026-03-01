import { Injectable, WritableSignal, inject, signal, type Signal } from '@angular/core';
import { Router } from '@angular/router';
import { HomeDataService } from './home-data.service.js';
import type { HeroMetric, QuickAction, QuickActionCommand, WeeklyHourSummary } from './home.models.js';

@Injectable()
export class HomeFacade {
  private readonly data = inject(HomeDataService);
  private readonly router = inject(Router);

  private readonly heroMetricsSignal = this.createHeroMetricsSignal();
  private readonly quickActionsSignal = this.createQuickActionsSignal();
  private readonly weeklyHoursSignal = this.createWeeklyHoursSignal();

  readonly heroMetrics: Signal<HeroMetric[]> = this.heroMetricsSignal.asReadonly();
  readonly quickActions: Signal<QuickAction[]> = this.quickActionsSignal.asReadonly();
  readonly weeklyHours: Signal<WeeklyHourSummary[]> = this.weeklyHoursSignal.asReadonly();

  startNewJob(): void {
    this.navigateWhenReady('/jobs/new');
  }

  startNextJob(): void {
    this.navigateWhenReady('/jobs/next');
  }

  startWarmLead(): void {
    this.navigateWhenReady('/leads/new');
  }

  startCustomerClosed(): void {
    this.navigateWhenReady('/customers/new');
  }

  undoLastEntry(): void {
    console.info('Undo last entry triggered');
  }

  openManageEmployees(): void {
    this.navigateWhenReady('/admin/employees');
  }

  openEmployeeDirectory(): void {
    this.navigateWhenReady('/admin/employees/directory');
  }

  openClients(): void {
    this.navigateWhenReady('/clients');
  }

  openSchedule(): void {
    this.navigateWhenReady('/schedule');
  }

  openFinances(): void {
    this.navigateWhenReady('/finances');
  }

  openUpcomingPay(): void {
    this.navigateWhenReady('/payroll/upcoming');
  }

  openPerformanceStats(): void {
    this.navigateWhenReady('/analytics/performance');
  }

  openClientBroadcast(): void {
    this.navigateWhenReady('/communications/broadcast');
  }

  openAdvancedOptions(): void {
    this.navigateWhenReady('/admin/advanced');
  }

  handleQuickAction(command: QuickActionCommand): void {
    switch (command) {
      case 'new-job':
        this.startNewJob();
        break;
      case 'start-next-job':
        this.startNextJob();
        break;
      case 'undo-job':
        this.undoLastEntry();
        break;
      case 'manage-employees':
        this.openManageEmployees();
        break;
      case 'view-employee-directory':
        this.openEmployeeDirectory();
        break;
      case 'view-clients':
        this.openClients();
        break;
      case 'view-schedule':
        this.openSchedule();
        break;
      case 'view-finances':
        this.openFinances();
        break;
      case 'view-upcoming-pay':
        this.openUpcomingPay();
        break;
      case 'view-performance':
        this.openPerformanceStats();
        break;
      case 'broadcast-clients':
        this.openClientBroadcast();
        break;
      case 'advanced-options':
        this.openAdvancedOptions();
        break;
      default:
        console.warn('Unhandled quick action', command);
    }
  }

  private createHeroMetricsSignal(): WritableSignal<HeroMetric[]> {
    return signal<HeroMetric[]>(this.data.getHeroMetrics());
  }

  private createQuickActionsSignal(): WritableSignal<QuickAction[]> {
    return signal<QuickAction[]>(this.data.getQuickActions());
  }

  private createWeeklyHoursSignal(): WritableSignal<WeeklyHourSummary[]> {
    return signal<WeeklyHourSummary[]>(this.data.getWeeklyHourSummaries());
  }

  private navigateWhenReady(url: string): void {
    void this.router.navigateByUrl(url).catch(() => {
      console.info(`Navigation target "${url}" is not ready yet.`);
    });
  }
}

