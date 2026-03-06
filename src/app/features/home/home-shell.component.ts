import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, inject, signal, ViewChild } from '@angular/core';
import { HeroMetricsComponent } from './components/hero-metrics/hero-metrics.component.js';
import { QuickActionsComponent } from './components/quick-actions/quick-actions.component.js';
import { EntryModalComponent } from '@shared/ui/entry-modal/entry-modal.component.js';
import { BrandBannerComponent } from '@shared/ui/brand-banner/brand-banner.component.js';
import type { EntryModalPayload } from '@shared/domain/entry/entry-modal.models.js';
import { HomeFacade } from './home.facade.js';

@Component({
  selector: 'app-home-shell',
  standalone: true,
  imports: [CommonModule, HeroMetricsComponent, QuickActionsComponent, EntryModalComponent, BrandBannerComponent],
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
  protected readonly entryModalOpen = signal(false);
  protected readonly entryModalVariant = signal<'warm-lead' | 'customer'>('warm-lead');

  protected startWarmLead(): void {
    this.closeAddEntryMenu();
    this.entryModalVariant.set('warm-lead');
    this.entryModalOpen.set(true);
  }

  protected startCustomerClosed(): void {
    this.closeAddEntryMenu();
    this.entryModalVariant.set('customer');
    this.entryModalOpen.set(true);
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

  protected closeEntryModal(): void {
    this.entryModalOpen.set(false);
  }

  protected handleEntrySaved(payload: EntryModalPayload): void {
    void this.facade
      .captureEntry(payload)
      .catch(() => {
        console.warn('Entry capture failed, please retry.');
      })
      .finally(() => this.closeEntryModal());
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
