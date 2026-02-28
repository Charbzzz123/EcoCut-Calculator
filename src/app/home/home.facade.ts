import { Injectable, WritableSignal, inject, signal, type Signal } from '@angular/core';
import { Router } from '@angular/router';
import { HomeDataService } from './home-data.service.js';
import type { HeroMetric, QuickAction, QuickActionCommand } from './home.models.js';

@Injectable()
export class HomeFacade {
  private readonly data = inject(HomeDataService);
  private readonly router = inject(Router);

  private readonly heroMetricsSignal = this.createHeroMetricsSignal();
  private readonly quickActionsSignal = this.createQuickActionsSignal();

  readonly heroMetrics: Signal<HeroMetric[]> = this.heroMetricsSignal.asReadonly();
  readonly quickActions: Signal<QuickAction[]> = this.quickActionsSignal.asReadonly();

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

  private createHeroMetricsSignal(): WritableSignal<HeroMetric[]> {
    return signal<HeroMetric[]>(this.data.getHeroMetrics());
  }

  private createQuickActionsSignal(): WritableSignal<QuickAction[]> {
    return signal<QuickAction[]>(this.data.getQuickActions());
  }

  private navigateWhenReady(url: string): void {
    void this.router.navigateByUrl(url).catch(() => {
      console.info(`Navigation target "${url}" is not ready yet.`);
    });
  }
}
