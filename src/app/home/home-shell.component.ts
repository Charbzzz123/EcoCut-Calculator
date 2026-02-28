import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { HeroMetricsComponent } from './components/hero-metrics/hero-metrics.component.js';
import { QuickActionsComponent } from './components/quick-actions/quick-actions.component.js';
import { HomeFacade } from './home.facade.js';

@Component({
  selector: 'app-home-shell',
  standalone: true,
  imports: [CommonModule, HeroMetricsComponent, QuickActionsComponent],
  templateUrl: './home-shell.component.html',
  styleUrl: './home-shell.component.scss',
  providers: [HomeFacade],
})
export class HomeShellComponent {
  protected readonly facade = inject(HomeFacade);
  protected readonly heroMetrics = this.facade.heroMetrics;
  protected readonly quickActions = this.facade.quickActions;

  protected onQuickAction(command: Parameters<HomeFacade['handleQuickAction']>[0]): void {
    this.facade.handleQuickAction(command);
  }
}
