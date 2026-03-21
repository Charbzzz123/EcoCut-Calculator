import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import type {
  EmployeeEditorMode,
  EmployeeHoursRecord,
  EmployeeLoadState,
  EmployeeOperatorRole,
  EmployeeRosterRecord,
  EmployeeStatusFilter,
} from './employees.types.js';
import { EmployeesFacade } from './employees.facade.js';
import { ManageEmployeesShellComponent } from './manage-employees-shell.component.js';

class EmployeesFacadeStub {
  readonly headingId = 'manage-employees-heading';
  readonly queryControl = new FormControl('', { nonNullable: true });
  readonly roleControl = new FormControl<EmployeeOperatorRole>('owner', { nonNullable: true });
  readonly profileForm = new FormGroup({
    firstName: new FormControl('', { nonNullable: true }),
    lastName: new FormControl('', { nonNullable: true }),
    phone: new FormControl('', { nonNullable: true }),
    email: new FormControl('', { nonNullable: true }),
    role: new FormControl('', { nonNullable: true }),
    hourlyRate: new FormControl('', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
  });
  readonly hoursForm = new FormGroup({
    workDate: new FormControl('2026-03-21', { nonNullable: true }),
    siteLabel: new FormControl('', { nonNullable: true }),
    hours: new FormControl('', { nonNullable: true }),
  });

  readonly loadRoster = vi.fn(() => Promise.resolve());
  readonly setStatusFilter = vi.fn((filter: EmployeeStatusFilter) => {
    this.statusFilterSignal.set(filter);
  });
  readonly openCreateProfile = vi.fn(() => {
    this.profileEditorOpenSignal.set(true);
    this.profileEditorModeSignal.set('create');
  });
  readonly openEditProfile = vi.fn((employeeId: string) => {
    this.editingEmployeeIdSignal.set(employeeId);
    this.profileEditorOpenSignal.set(true);
    this.profileEditorModeSignal.set('edit');
  });
  readonly archiveEmployee = vi.fn();
  readonly saveProfile = vi.fn(() => true);
  readonly cancelProfileEditor = vi.fn(() => this.profileEditorOpenSignal.set(false));
  readonly openHoursEditor = vi.fn((employeeId: string) => {
    this.selectedHoursEmployeeIdSignal.set(employeeId);
  });
  readonly closeHoursEditor = vi.fn(() => this.selectedHoursEmployeeIdSignal.set(null));
  readonly saveHoursEntry = vi.fn(() => true);
  readonly editHoursEntry = vi.fn();
  readonly removeHoursEntry = vi.fn();
  readonly trackByEmployeeId = vi.fn((_: number, employee: EmployeeRosterRecord) => employee.id);
  readonly trackByHoursEntryId = vi.fn((_: number, entry: EmployeeHoursRecord) => entry.id);

  private readonly loadStateSignal = signal<EmployeeLoadState>('loading');
  readonly loadState = this.loadStateSignal.asReadonly();

  private readonly statusFilterSignal = signal<EmployeeStatusFilter>('all');
  readonly statusFilter = this.statusFilterSignal.asReadonly();

  private readonly roleSignal = signal<EmployeeOperatorRole>('owner');
  readonly operatorRole = this.roleSignal.asReadonly();
  readonly canEditExistingProfiles = () => this.roleSignal() === 'owner';
  readonly canArchiveProfiles = () => this.roleSignal() === 'owner';

  private readonly workspaceNoticeSignal = signal<string | null>(null);
  readonly workspaceNotice = this.workspaceNoticeSignal.asReadonly();

  private readonly profileEditorOpenSignal = signal(false);
  readonly profileEditorOpen = this.profileEditorOpenSignal.asReadonly();

  private readonly profileEditorModeSignal = signal<EmployeeEditorMode>('create');
  readonly profileEditorMode = this.profileEditorModeSignal.asReadonly();

  private readonly editingEmployeeIdSignal = signal<string | null>(null);
  readonly editingEmployeeId = this.editingEmployeeIdSignal.asReadonly();

  private readonly profileErrorsSignal = signal<string[]>([]);
  readonly profileErrors = this.profileErrorsSignal.asReadonly();

  private readonly rosterSignal = signal<EmployeeRosterRecord[]>([]);
  private readonly filteredRosterSignal = signal<EmployeeRosterRecord[]>([]);
  private readonly selectedHoursEmployeeIdSignal = signal<string | null>(null);
  private readonly hoursEntriesSignal = signal<EmployeeHoursRecord[]>([]);
  private readonly editingHoursEntryIdSignal = signal<string | null>(null);
  private readonly hoursErrorsSignal = signal<string[]>([]);
  private stats = { total: 0, active: 0, inactive: 0 };

  readonly rosterSnapshot = vi.fn(() => this.rosterSignal());
  readonly filteredRosterSnapshot = vi.fn(() => this.filteredRosterSignal());
  readonly statsSnapshot = vi.fn(() => this.stats);
  readonly activeEmployee = () =>
    this.rosterSignal().find((employee) => employee.id === this.editingEmployeeIdSignal()) ?? null;
  readonly hoursEditorOpen = () => this.selectedHoursEmployeeIdSignal() !== null;
  readonly selectedHoursEmployee = () =>
    this.rosterSignal().find((employee) => employee.id === this.selectedHoursEmployeeIdSignal()) ?? null;
  readonly selectedHoursEntries = () =>
    this.hoursEntriesSignal().filter((entry) => entry.employeeId === this.selectedHoursEmployeeIdSignal());
  readonly selectedHoursTotals = () => ({
    totalHours: `${this.selectedHoursEntries().reduce((sum, entry) => sum + entry.hours, 0)}`,
    entryCount: this.selectedHoursEntries().length,
    lastUpdated: this.selectedHoursEntries()[0]?.updatedAt ?? '—',
  });
  readonly editingHoursEntry = () =>
    this.selectedHoursEntries().find((entry) => entry.id === this.editingHoursEntryIdSignal()) ?? null;
  readonly hoursErrors = this.hoursErrorsSignal.asReadonly();

  setViewModel(options: {
    loadState?: EmployeeLoadState;
    statusFilter?: EmployeeStatusFilter;
    role?: EmployeeOperatorRole;
    workspaceNotice?: string | null;
    profileEditorOpen?: boolean;
    profileEditorMode?: EmployeeEditorMode;
    editingEmployeeId?: string | null;
    profileErrors?: string[];
    roster?: EmployeeRosterRecord[];
    filteredRoster?: EmployeeRosterRecord[];
    stats?: { total: number; active: number; inactive: number };
    selectedHoursEmployeeId?: string | null;
    hoursEntries?: EmployeeHoursRecord[];
    editingHoursEntryId?: string | null;
    hoursErrors?: string[];
  }): void {
    if (options.loadState) {
      this.loadStateSignal.set(options.loadState);
    }
    if (options.statusFilter) {
      this.statusFilterSignal.set(options.statusFilter);
    }
    if (options.role) {
      this.roleSignal.set(options.role);
      this.roleControl.setValue(options.role, { emitEvent: false });
    }
    if (options.workspaceNotice !== undefined) {
      this.workspaceNoticeSignal.set(options.workspaceNotice);
    }
    if (options.profileEditorOpen !== undefined) {
      this.profileEditorOpenSignal.set(options.profileEditorOpen);
    }
    if (options.profileEditorMode) {
      this.profileEditorModeSignal.set(options.profileEditorMode);
    }
    if (options.editingEmployeeId !== undefined) {
      this.editingEmployeeIdSignal.set(options.editingEmployeeId);
    }
    if (options.profileErrors) {
      this.profileErrorsSignal.set(options.profileErrors);
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
    if (options.selectedHoursEmployeeId !== undefined) {
      this.selectedHoursEmployeeIdSignal.set(options.selectedHoursEmployeeId);
    }
    if (options.hoursEntries) {
      this.hoursEntriesSignal.set(options.hoursEntries);
    }
    if (options.editingHoursEntryId !== undefined) {
      this.editingHoursEntryIdSignal.set(options.editingHoursEntryId);
    }
    if (options.hoursErrors) {
      this.hoursErrorsSignal.set(options.hoursErrors);
    }
  }
}

const activeRecord: EmployeeRosterRecord = {
  id: 'emp-1',
  firstName: 'Alex',
  lastName: 'Karam',
  fullName: 'Alex Karam',
  phone: '(438) 111-1111',
  email: 'alex@ecocutqc.com',
  role: 'Crew lead',
  hourlyRate: 34,
  notes: 'Lead route.',
  status: 'active',
  lastActivityAt: '2026-03-20T14:00:00Z',
};

const inactiveRecord: EmployeeRosterRecord = {
  id: 'emp-2',
  firstName: 'Nora',
  lastName: 'Bitar',
  fullName: 'Nora Bitar',
  phone: '(438) 222-2222',
  email: null,
  role: 'Crew support',
  hourlyRate: 24,
  notes: '',
  status: 'inactive',
  lastActivityAt: null,
};

const hoursEntry: EmployeeHoursRecord = {
  id: 'hours-1',
  employeeId: 'emp-1',
  workDate: '2026-03-20',
  siteLabel: 'Westmount',
  hours: 8,
  updatedByRole: 'owner',
  updatedAt: '2026-03-20T17:30:00Z',
};

describe('ManageEmployeesShellComponent', () => {
  let facade: EmployeesFacadeStub;

  beforeEach(async () => {
    facade = new EmployeesFacadeStub();
    await TestBed.configureTestingModule({
      imports: [ManageEmployeesShellComponent],
      providers: [provideRouter([]), { provide: EmployeesFacade, useValue: facade }],
    }).compileComponents();
  });

  it('loads roster on init and renders shell content', () => {
    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();

    const native = fixture.nativeElement as HTMLElement;
    expect(facade.loadRoster).toHaveBeenCalledTimes(1);
    expect(native.querySelector('h1')?.textContent).toContain('Manage employees');
    expect(native.querySelectorAll('.slice-card')).toHaveLength(3);
  });

  it('renders loading, error, and empty states', () => {
    facade.setViewModel({ loadState: 'loading' });
    let fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.roster-state')?.textContent).toContain(
      'Loading employee roster',
    );

    fixture.destroy();
    facade.setViewModel({ loadState: 'error' });
    fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    const retry = fixture.nativeElement.querySelector('.retry-btn') as HTMLButtonElement;
    const beforeRetryCalls = facade.loadRoster.mock.calls.length;
    retry.click();
    expect(facade.loadRoster).toHaveBeenCalledTimes(beforeRetryCalls + 1);

    fixture.destroy();
    facade.setViewModel({ loadState: 'ready', roster: [], filteredRoster: [] });
    fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.roster-state')?.textContent).toContain(
      'No employees match this filter.',
    );
  });

  it('forwards roster actions and role toggles', () => {
    facade.setViewModel({
      loadState: 'ready',
      role: 'owner',
      roster: [activeRecord],
      filteredRoster: [activeRecord],
      stats: { total: 1, active: 1, inactive: 0 },
    });
    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();

    const native = fixture.nativeElement as HTMLElement;
    (native.querySelector('.add-btn') as HTMLButtonElement).click();
    expect(facade.openCreateProfile).toHaveBeenCalled();

    const roleButtons = native.querySelectorAll('.role-mode .status-pill');
    (roleButtons[1] as HTMLButtonElement).click();
    expect(facade.roleControl.value).toBe('manager');

    const employeeActions = native.querySelectorAll('.employee-card__actions .employee-action');
    (employeeActions[0] as HTMLButtonElement).click();
    (employeeActions[1] as HTMLButtonElement).click();
    (employeeActions[2] as HTMLButtonElement).click();
    expect(facade.openHoursEditor).toHaveBeenCalledWith('emp-1');
    expect(facade.openEditProfile).toHaveBeenCalledWith('emp-1');
    expect(facade.archiveEmployee).toHaveBeenCalledWith('emp-1');

    const statusButtons = native.querySelectorAll('.status-filters .status-pill');
    (statusButtons[0] as HTMLButtonElement).click();
    (statusButtons[1] as HTMLButtonElement).click();
    (statusButtons[2] as HTMLButtonElement).click();
    expect(facade.setStatusFilter).toHaveBeenCalledWith('all');
    expect(facade.setStatusFilter).toHaveBeenCalledWith('active');
    expect(facade.setStatusFilter).toHaveBeenCalledWith('inactive');
  });

  it('disables owner-only actions in manager mode', () => {
    facade.setViewModel({
      loadState: 'ready',
      role: 'manager',
      workspaceNotice: 'Manager mode can add employees and edit hours only.',
      roster: [activeRecord, inactiveRecord],
      filteredRoster: [activeRecord, inactiveRecord],
      stats: { total: 2, active: 1, inactive: 1 },
    });
    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();

    const native = fixture.nativeElement as HTMLElement;
    expect(native.querySelector('.workspace-notice')?.textContent).toContain('Manager mode');

    const cardActions = native.querySelectorAll('.employee-card__actions');
    const firstEdit = cardActions[0]?.querySelectorAll('.employee-action')[1] as HTMLButtonElement;
    const firstArchive = cardActions[0]?.querySelectorAll('.employee-action')[2] as HTMLButtonElement;
    expect(firstEdit.disabled).toBe(true);
    expect(firstArchive.disabled).toBe(true);
  });

  it('renders profile editor states and forwards submit/cancel', () => {
    facade.setViewModel({ profileEditorOpen: false });
    let fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.editor-placeholder')).toBeTruthy();

    fixture.destroy();
    facade.setViewModel({
      loadState: 'ready',
      profileEditorOpen: true,
      profileEditorMode: 'edit',
      editingEmployeeId: activeRecord.id,
      profileErrors: ['Required fields missing: First name.'],
      roster: [activeRecord],
      filteredRoster: [activeRecord],
    });
    facade.profileForm.patchValue({
      firstName: 'Alex',
      lastName: 'Karam',
      phone: '(438) 111-1111',
      email: 'alex@ecocutqc.com',
      role: 'Crew lead',
      hourlyRate: '34',
      notes: 'Lead route.',
    });
    fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();

    const native = fixture.nativeElement as HTMLElement;
    expect(native.querySelector('.error-summary')?.textContent).toContain('Fix the following');
    expect(native.querySelector('.editing-note')?.textContent).toContain('Alex Karam');

    const cancelButton = Array.from(native.querySelectorAll('.employee-action')).find((button) =>
      button.textContent?.includes('Cancel'),
    ) as HTMLButtonElement;
    cancelButton.click();
    expect(facade.cancelProfileEditor).toHaveBeenCalled();

    const form = native.querySelector('.profile-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(facade.saveProfile).toHaveBeenCalled();
  });

  it('renders hours editor states and forwards hours actions', () => {
    facade.setViewModel({
      loadState: 'ready',
      role: 'owner',
      roster: [activeRecord],
      filteredRoster: [activeRecord],
      selectedHoursEmployeeId: activeRecord.id,
      hoursEntries: [hoursEntry],
      editingHoursEntryId: hoursEntry.id,
      hoursErrors: ['Required fields missing: Hours.'],
    });
    facade.hoursForm.patchValue({ workDate: '2026-03-20', siteLabel: 'Westmount', hours: '8' });

    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    const native = fixture.nativeElement as HTMLElement;

    expect(native.querySelector('.hours-context__employee')?.textContent).toContain('Alex Karam');
    expect(native.querySelector('.hours-list .hours-card')).toBeTruthy();
    expect(native.querySelector('.error-summary')?.textContent).toContain('Fix the following');

    const hoursActions = native.querySelectorAll('.hours-card .employee-action');
    (hoursActions[0] as HTMLButtonElement).click();
    (hoursActions[1] as HTMLButtonElement).click();
    expect(facade.editHoursEntry).toHaveBeenCalledWith('hours-1');
    expect(facade.removeHoursEntry).toHaveBeenCalledWith('hours-1');

    const save = native.querySelector('.hours-form') as HTMLFormElement;
    save.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(facade.saveHoursEntry).toHaveBeenCalled();

    const closeButton = native.querySelector('.employees-hours__header .employee-action') as HTMLButtonElement;
    closeButton.click();
    expect(facade.closeHoursEditor).toHaveBeenCalled();
  });

  it('renders new-hours branch without editing state', () => {
    facade.setViewModel({
      loadState: 'ready',
      role: 'manager',
      roster: [activeRecord],
      filteredRoster: [activeRecord],
      selectedHoursEmployeeId: activeRecord.id,
      hoursEntries: [],
      editingHoursEntryId: null,
      hoursErrors: [],
    });

    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    const native = fixture.nativeElement as HTMLElement;

    expect(native.querySelector('.hours-list .hours-card')).toBeNull();
    expect(native.querySelector('.error-summary')).toBeNull();
    expect(native.querySelector('.hours-form button[type="submit"]')?.textContent).toContain(
      'Save hours',
    );
  });
});
