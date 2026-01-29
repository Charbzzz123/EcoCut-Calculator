import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { HomeFacade } from './home.facade';
import { HeroMetricsComponent } from './components/hero-metrics/hero-metrics.component';
import { QuickActionsComponent } from './components/quick-actions/quick-actions.component';
import { ActivityFeedComponent } from './components/activity-feed/activity-feed.component';
import { AlertsPanelComponent } from './components/alerts-panel/alerts-panel.component';
import { WeeklyPayrollComponent } from './components/weekly-payroll/weekly-payroll.component';
import { PrfTrendComponent } from './components/prf-trend/prf-trend.component';
import type { QuickActionCommand } from './home.models';

@Component({
  selector: 'app-home-shell',
  standalone: true,
  imports: [
    CommonModule,
    HeroMetricsComponent,
    QuickActionsComponent,
    ActivityFeedComponent,
    AlertsPanelComponent,
    WeeklyPayrollComponent,
    PrfTrendComponent,
  ],
  templateUrl: './home-shell.component.html',
  styleUrl: './home-shell.component.scss',
  providers: [HomeFacade],
})
export class HomeShellComponent {
  protected readonly facade = inject(HomeFacade);
  protected readonly heroMetrics = this.facade.heroMetrics;
  protected readonly quickActions = this.facade.quickActions;
  protected readonly recentJobs = this.facade.recentJobs;
  protected readonly alerts = this.facade.alerts;
  protected readonly weeklyPayroll = this.facade.weeklyPayroll;
  protected readonly prfTrend = this.facade.prfTrend;

  protected onQuickAction(command: QuickActionCommand): void {
    this.facade.handleQuickAction(command);
  }
}
