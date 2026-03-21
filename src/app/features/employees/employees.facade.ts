import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs';
import { EmployeesDataService } from './employees-data.service.js';
import type {
  EmployeeLoadState,
  EmployeeRosterRecord,
  EmployeeStatusFilter,
} from './employees.types.js';

const digitsOnly = (value: string): string => value.replace(/\D/g, '');

@Injectable({ providedIn: 'root' })
export class EmployeesFacade {
  private readonly data = inject(EmployeesDataService);

  readonly headingId = 'manage-employees-heading';
  readonly queryControl = new FormControl('', { nonNullable: true });

  private readonly querySignal: WritableSignal<string> = signal('');
  private readonly statusFilterSignal: WritableSignal<EmployeeStatusFilter> =
    signal<EmployeeStatusFilter>('all');
  private readonly rosterSignal: WritableSignal<EmployeeRosterRecord[]> =
    signal<EmployeeRosterRecord[]>([]);
  private readonly loadStateSignal: WritableSignal<EmployeeLoadState> =
    signal<EmployeeLoadState>('loading');

  readonly statusFilter: Signal<EmployeeStatusFilter> = this.statusFilterSignal.asReadonly();
  readonly loadState: Signal<EmployeeLoadState> = this.loadStateSignal.asReadonly();
  readonly filteredRoster: Signal<EmployeeRosterRecord[]> = computed(() =>
    this.filterRoster(this.rosterSignal(), this.querySignal(), this.statusFilterSignal()),
  );
  readonly stats: Signal<{ total: number; active: number; inactive: number }> = computed(() =>
    this.computeStats(this.rosterSignal()),
  );

  constructor() {

    this.queryControl.valueChanges
      .pipe(startWith(''), debounceTime(150), distinctUntilChanged())
      .subscribe((value) => this.querySignal.set(value));
  }

  setStatusFilter(filter: EmployeeStatusFilter): void {
    this.statusFilterSignal.set(filter);
  }

  filteredRosterSnapshot(): EmployeeRosterRecord[] {
    return this.filteredRoster();
  }

  rosterSnapshot(): EmployeeRosterRecord[] {
    return this.rosterSignal();
  }

  statsSnapshot(): { total: number; active: number; inactive: number } {
    return this.stats();
  }

  trackByEmployeeId = (_: number, employee: EmployeeRosterRecord): string => employee.id;

  async loadRoster(): Promise<void> {
    this.loadStateSignal.set('loading');
    try {
      const roster = await this.data.listEmployees();
      this.rosterSignal.set(roster);
      this.loadStateSignal.set('ready');
    } catch (error) {
      console.warn('Failed to load employee roster', error);
      this.loadStateSignal.set('error');
    }
  }

  private filterRoster(
    roster: EmployeeRosterRecord[],
    rawQuery: string,
    filter: EmployeeStatusFilter,
  ): EmployeeRosterRecord[] {
    const normalizedQuery = rawQuery.trim().toLowerCase();
    const queryDigits = digitsOnly(rawQuery);

    return roster.filter((employee) => {
      if (filter !== 'all' && employee.status !== filter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const phoneDigits = digitsOnly(employee.phone);
      return (
        employee.fullName.toLowerCase().includes(normalizedQuery) ||
        employee.role.toLowerCase().includes(normalizedQuery) ||
        employee.phone.toLowerCase().includes(normalizedQuery) ||
        (employee.email?.toLowerCase().includes(normalizedQuery) ?? false) ||
        (queryDigits.length >= 3 && phoneDigits.includes(queryDigits))
      );
    });
  }

  private computeStats(roster: EmployeeRosterRecord[]): {
    total: number;
    active: number;
    inactive: number;
  } {
    const active = roster.filter((employee) => employee.status === 'active').length;
    const inactive = roster.length - active;
    return {
      total: roster.length,
      active,
      inactive,
    };
  }
}
