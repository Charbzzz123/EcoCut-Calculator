import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import type {
  EmployeeLoadState,
  EmployeeRosterRecord,
  EmployeeStatusFilter,
} from './employees.types.js';
import { EmployeesFacade } from './employees.facade.js';
import { ManageEmployeesShellComponent } from './manage-employees-shell.component.js';

class EmployeesFacadeStub {
  readonly headingId = 'manage-employees-heading';
  readonly queryControl = new FormControl('', { nonNullable: true });
  readonly loadRoster = vi.fn(() => Promise.resolve());
  readonly setStatusFilter = vi.fn((filter: EmployeeStatusFilter) => {
    this.statusFilterSignal.set(filter);
  });
  readonly trackByEmployeeId = vi.fn((_: number, employee: EmployeeRosterRecord) => employee.id);

  private readonly loadStateSignal = signal<EmployeeLoadState>('loading');
  readonly loadState = this.loadStateSignal.asReadonly();

  private readonly statusFilterSignal = signal<EmployeeStatusFilter>('all');
  readonly statusFilter = this.statusFilterSignal.asReadonly();

  private readonly rosterSignal = signal<EmployeeRosterRecord[]>([]);
  private readonly filteredRosterSignal = signal<EmployeeRosterRecord[]>([]);
  private stats = { total: 0, active: 0, inactive: 0 };

  readonly rosterSnapshot = vi.fn(() => this.rosterSignal());
  readonly filteredRosterSnapshot = vi.fn(() => this.filteredRosterSignal());
  readonly statsSnapshot = vi.fn(() => this.stats);

  setViewModel(options: {
    loadState?: EmployeeLoadState;
    statusFilter?: EmployeeStatusFilter;
    roster?: EmployeeRosterRecord[];
    filteredRoster?: EmployeeRosterRecord[];
    stats?: { total: number; active: number; inactive: number };
  }): void {
    if (options.loadState) {
      this.loadStateSignal.set(options.loadState);
    }
    if (options.statusFilter) {
      this.statusFilterSignal.set(options.statusFilter);
    }
    if (options.roster) {
      this.rosterSignal.set(options.roster);
    }
    if (options.filteredRoster) {
      this.filteredRosterSignal.set(options.filteredRoster);
    }
    if (options.stats) {
      this.stats = options.stats;
    }
  }
}

describe('ManageEmployeesShellComponent', () => {
  let facade: EmployeesFacadeStub;

  beforeEach(async () => {
    facade = new EmployeesFacadeStub();
    await TestBed.configureTestingModule({
      imports: [ManageEmployeesShellComponent],
      providers: [provideRouter([]), { provide: EmployeesFacade, useValue: facade }],
    }).compileComponents();
  });

  it('loads roster on init and renders hero structure', () => {
    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();

    const native = fixture.nativeElement as HTMLElement;
    expect(facade.loadRoster).toHaveBeenCalledTimes(1);
    expect(native.querySelector('h1')?.textContent).toContain('Manage employees');
    expect(native.querySelectorAll('.slice-card')).toHaveLength(3);

    const refresh = native.querySelector('.refresh-btn') as HTMLButtonElement;
    refresh.click();
    expect(facade.loadRoster).toHaveBeenCalledTimes(2);
  });

  it('renders loading state', () => {
    facade.setViewModel({ loadState: 'loading' });
    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();

    const native = fixture.nativeElement as HTMLElement;
    expect(native.querySelector('.roster-state')?.textContent).toContain('Loading employee roster');
  });

  it('renders error state and retries loading', () => {
    facade.setViewModel({ loadState: 'error' });
    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();

    const retry = fixture.nativeElement.querySelector('.retry-btn') as HTMLButtonElement;
    expect(retry).toBeTruthy();
    retry.click();
    expect(facade.loadRoster).toHaveBeenCalledTimes(2);
  });

  it('renders empty state when no filtered employees are available', () => {
    facade.setViewModel({ loadState: 'ready', roster: [], filteredRoster: [] });
    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();

    const native = fixture.nativeElement as HTMLElement;
    expect(native.querySelector('.roster-state')?.textContent).toContain(
      'No employees match this filter.',
    );
  });

  it('renders roster cards and applies status-filter actions', () => {
    facade.setViewModel({
      loadState: 'ready',
      statusFilter: 'all',
      roster: [
        {
          id: 'emp-1',
          firstName: 'Alex',
          lastName: 'Karam',
          fullName: 'Alex Karam',
          phone: '(438) 111-1111',
          email: 'alex@ecocutqc.com',
          role: 'Crew lead',
          hourlyRate: 34,
          status: 'active',
          lastActivityAt: '2026-03-20T14:00:00Z',
        },
      ],
      filteredRoster: [
        {
          id: 'emp-1',
          firstName: 'Alex',
          lastName: 'Karam',
          fullName: 'Alex Karam',
          phone: '(438) 111-1111',
          email: 'alex@ecocutqc.com',
          role: 'Crew lead',
          hourlyRate: 34,
          status: 'active',
          lastActivityAt: '2026-03-20T14:00:00Z',
        },
      ],
      stats: { total: 1, active: 1, inactive: 0 },
    });
    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();

    const native = fixture.nativeElement as HTMLElement;
    expect(native.querySelectorAll('.employee-card')).toHaveLength(1);
    expect(native.querySelector('.summary-card__value')?.textContent?.trim()).toBe('1');

    const activeFilter = Array.from(native.querySelectorAll('.status-pill')).find((button) =>
      button.textContent?.includes('Active'),
    ) as HTMLButtonElement;
    const allFilter = Array.from(native.querySelectorAll('.status-pill')).find((button) =>
      button.textContent?.includes('All'),
    ) as HTMLButtonElement;
    const inactiveFilter = Array.from(native.querySelectorAll('.status-pill')).find((button) =>
      button.textContent?.includes('Inactive'),
    ) as HTMLButtonElement;

    allFilter.click();
    activeFilter.click();
    inactiveFilter.click();
    expect(facade.setStatusFilter).toHaveBeenCalledWith('all');
    expect(facade.setStatusFilter).toHaveBeenCalledWith('active');
    expect(facade.setStatusFilter).toHaveBeenCalledWith('inactive');
  });

  it('shows fallback copy for missing email and activity metadata', () => {
    facade.setViewModel({
      loadState: 'ready',
      roster: [
        {
          id: 'emp-2',
          firstName: 'Nora',
          lastName: 'Bitar',
          fullName: 'Nora Bitar',
          phone: '(438) 222-2222',
          email: null,
          role: 'Crew support',
          hourlyRate: 24,
          status: 'inactive',
          lastActivityAt: null,
        },
      ],
      filteredRoster: [
        {
          id: 'emp-2',
          firstName: 'Nora',
          lastName: 'Bitar',
          fullName: 'Nora Bitar',
          phone: '(438) 222-2222',
          email: null,
          role: 'Crew support',
          hourlyRate: 24,
          status: 'inactive',
          lastActivityAt: null,
        },
      ],
      stats: { total: 1, active: 0, inactive: 1 },
    });

    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();

    const native = fixture.nativeElement as HTMLElement;
    expect(native.querySelector('.employee-card__contact')?.textContent).toContain('No email');
    expect(native.querySelector('.employee-card__activity')?.textContent).toContain('Last activity:');
    expect(native.querySelector('.status-chip--inactive')?.textContent).toContain('Inactive');
  });
});
