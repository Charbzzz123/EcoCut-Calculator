import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, inject, signal, ViewChild } from '@angular/core';
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
  @ViewChild('addEntryDropdown', { static: true }) private addEntryDropdown?: ElementRef<HTMLElement>;

  protected readonly facade = inject(HomeFacade);
  protected readonly heroMetrics = this.facade.heroMetrics;
  protected readonly quickActions = this.facade.quickActions;
  protected readonly weeklyHours = this.facade.weeklyHours;
  protected readonly addEntryMenuOpen = signal(false);

  protected startWarmLead(): void {
    this.closeAddEntryMenu();
    this.facade.startWarmLead();
  }

  protected startCustomerClosed(): void {
    this.closeAddEntryMenu();
    this.facade.startCustomerClosed();
  }

  protected onQuickAction(command: Parameters<HomeFacade['handleQuickAction']>[0]): void {
    this.facade.handleQuickAction(command);
  }

  protected toggleAddEntryMenu(): void {
    this.addEntryMenuOpen.update((isOpen) => !isOpen);
  }

  protected openAddEntryMenu(): void {
    this.addEntryMenuOpen.set(true);
  }

  protected closeAddEntryMenu(): void {
    this.addEntryMenuOpen.set(false);
  }

  protected handleDropdownFocusOut(event: FocusEvent): void {
    const container = event.currentTarget as HTMLElement | null;
    const nextTarget = event.relatedTarget as HTMLElement | null;

    if (!container || !nextTarget) {
      this.closeAddEntryMenu();
      return;
    }

    if (!container.contains(nextTarget)) {
      this.closeAddEntryMenu();
    }
  }

  @HostListener('document:click', ['$event'])
  protected handleDocumentClick(event: MouseEvent): void {
    if (!this.addEntryMenuOpen()) {
      return;
    }

    const dropdownEl = this.addEntryDropdown?.nativeElement;
    if (dropdownEl && !dropdownEl.contains(event.target as Node)) {
      this.closeAddEntryMenu();
    }
  }
}
