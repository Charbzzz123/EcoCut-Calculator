import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import type {
  EmployeeEditorMode,
  EmployeeHoursRecord,
  EmployeeLoggedJobOption,
  EmployeeJobHistoryRecord,
  EmployeeLoadState,
  EmployeeOperatorRole,
  EmployeeStartNextJobReadiness,
  EmployeeRosterRecord,
  EmployeeStatusFilter,
} from './employees.types.js';
import { EmployeesFacade } from './employees.facade.js';
import type { EmployeeClockSummary } from './employees.facade.js';
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
    jobEntryId: new FormControl('__manual__', { nonNullable: true }),
    correctionNote: new FormControl('', { nonNullable: true }),
    hours: new FormControl('', { nonNullable: true }),
  });
  readonly historyForm = new FormGroup({
    siteLabel: new FormControl('', { nonNullable: true }),
    address: new FormControl('', { nonNullable: true }),
    scheduledStart: new FormControl('', { nonNullable: true }),
    scheduledEnd: new FormControl('', { nonNullable: true }),
  });
  readonly addressVerificationRequired = false;
  readonly handleHistoryAddressFocus = vi.fn();
  readonly handleHistoryAddressBlur = vi.fn();
  readonly selectHistoryAddressSuggestion = vi.fn();

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
  readonly restoreEmployee = vi.fn();
  readonly saveProfile = vi.fn(async () => true);
  readonly cancelProfileEditor = vi.fn(() => this.profileEditorOpenSignal.set(false));
  readonly openHoursEditor = vi.fn((employeeId: string) => {
    this.selectedHoursEmployeeIdSignal.set(employeeId);
  });
  readonly openJobHistory = vi.fn((employeeId: string) => {
    this.selectedHistoryEmployeeIdSignal.set(employeeId);
  });
  readonly closeHoursEditor = vi.fn(() => this.selectedHoursEmployeeIdSignal.set(null));
  readonly closeJobHistory = vi.fn(() => {
    this.selectedHistoryEmployeeIdSignal.set(null);
    this.editingHistoryEntryIdSignal.set(null);
    this.historyErrorsSignal.set([]);
  });
  readonly startHistoryEdit = vi.fn((entryId: string) => {
    this.editingHistoryEntryIdSignal.set(entryId);
  });
  readonly cancelHistoryEdit = vi.fn(() => {
    this.editingHistoryEntryIdSignal.set(null);
    this.historyErrorsSignal.set([]);
  });
  readonly saveHistoryEdit = vi.fn(async () => true);
  readonly saveHoursEntry = vi.fn(async () => true);
  readonly editHoursEntry = vi.fn();
  readonly removeHoursEntry = vi.fn();
  readonly clockIn = vi.fn();
  readonly clockOut = vi.fn();
  readonly trackByEmployeeId = vi.fn((_: number, employee: EmployeeRosterRecord) => employee.id);
  readonly trackByHoursEntryId = vi.fn((_: number, entry: EmployeeHoursRecord) => entry.id);
  readonly trackByHistoryEntryId = vi.fn((_: number, entry: EmployeeJobHistoryRecord) => entry.id);
  readonly trackByReadinessEmployeeId = vi.fn(
    (_: number, entry: EmployeeStartNextJobReadiness) => entry.employeeId,
  );
  readonly trackByClockEmployeeId = vi.fn(
    (_: number, entry: EmployeeClockSummary) => entry.employeeId,
  );

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
  private readonly jobOptionsSignal = signal<EmployeeLoggedJobOption[]>([]);
  private readonly selectedHistoryEmployeeIdSignal = signal<string | null>(null);
  private readonly editingHistoryEntryIdSignal = signal<string | null>(null);
  private readonly historyEntriesSignal = signal<EmployeeJobHistoryRecord[]>([]);
  private readonly readinessSignal = signal<EmployeeStartNextJobReadiness[]>([]);
  private readonly clockSignal = signal<EmployeeClockSummary[]>([]);
  private readonly editingHoursEntryIdSignal = signal<string | null>(null);
  private readonly hoursErrorsSignal = signal<string[]>([]);
  private readonly hoursSuccessSignal = signal<string | null>(null);
  private readonly historyErrorsSignal = signal<string[]>([]);
  private readonly historySuccessSignal = signal<string | null>(null);
  private readonly historyAddressSuggestionsSignal = signal<
    { id: string; primaryText: string; secondaryText?: string }[]
  >([]);
  private readonly showHistoryAddressSuggestionsSignal = signal(false);
  private readonly historyAddressLookupLoadingSignal = signal(false);
  private readonly historyAddressLookupMessageSignal = signal<string | null>(null);
  private readonly historyAddressVerifiedSignal = signal(false);
  private stats = { total: 0, active: 0, inactive: 0 };

  readonly rosterSnapshot = vi.fn(() => this.rosterSignal());
  readonly filteredRosterSnapshot = vi.fn(() => this.filteredRosterSignal());
  readonly statsSnapshot = vi.fn(() => this.stats);
  readonly activeEmployee = () =>
    this.rosterSignal().find((employee) => employee.id === this.editingEmployeeIdSignal()) ?? null;
  readonly hoursEditorOpen = () => this.selectedHoursEmployeeIdSignal() !== null;
  readonly selectedHoursEmployee = () =>
    this.rosterSignal().find((employee) => employee.id === this.selectedHoursEmployeeIdSignal()) ??
    null;
  readonly selectedHoursEntries = () =>
    this.hoursEntriesSignal().filter(
      (entry) => entry.employeeId === this.selectedHoursEmployeeIdSignal(),
    );
  readonly selectedHoursTotals = () => ({
    totalHours: `${this.selectedHoursEntries().reduce((sum, entry) => sum + entry.hours, 0)}`,
    entryCount: this.selectedHoursEntries().length,
    lastUpdated: this.selectedHoursEntries()[0]?.updatedAt ?? '—',
  });
  readonly editingHoursEntry = () =>
    this.selectedHoursEntries().find((entry) => entry.id === this.editingHoursEntryIdSignal()) ??
    null;
  readonly hoursErrors = this.hoursErrorsSignal.asReadonly();
  readonly hoursSuccess = this.hoursSuccessSignal.asReadonly();
  readonly loggedJobOptions = this.jobOptionsSignal.asReadonly();
  readonly selectedHoursJobOption = () => {
    const selectedId = this.hoursForm.controls.jobEntryId.value;
    if (!selectedId || selectedId === '__manual__') {
      return null;
    }
    return this.jobOptionsSignal().find((option) => option.entryId === selectedId) ?? null;
  };
  readonly isManualHoursSelection = () => this.hoursForm.controls.jobEntryId.value === '__manual__';
  readonly historyPanelOpen = () => this.selectedHistoryEmployeeIdSignal() !== null;
  readonly selectedHistoryEmployee = () =>
    this.rosterSignal().find(
      (employee) => employee.id === this.selectedHistoryEmployeeIdSignal(),
    ) ?? null;
  readonly selectedEmployeeJobHistory = () =>
    this.historyEntriesSignal().filter(
      (entry) => entry.employeeId === this.selectedHistoryEmployeeIdSignal(),
    );
  readonly historyEditorOpen = () => this.editingHistoryEntryIdSignal() !== null;
  readonly editingHistoryEntry = () =>
    this.selectedEmployeeJobHistory().find(
      (entry) => entry.id === this.editingHistoryEntryIdSignal(),
    ) ?? null;
  readonly historyErrors = this.historyErrorsSignal.asReadonly();
  readonly historySuccess = this.historySuccessSignal.asReadonly();
  readonly historyAddressSuggestions = this.historyAddressSuggestionsSignal.asReadonly();
  readonly showHistoryAddressSuggestions = this.showHistoryAddressSuggestionsSignal.asReadonly();
  readonly historyAddressLookupLoading = this.historyAddressLookupLoadingSignal.asReadonly();
  readonly historyAddressLookupMessage = this.historyAddressLookupMessageSignal.asReadonly();
  readonly historyAddressVerified = this.historyAddressVerifiedSignal.asReadonly();
  readonly selectedHistorySummary = () => {
    const entries = this.selectedEmployeeJobHistory();
    const completedCount = entries.filter((entry) => entry.status === 'completed').length;
    return {
      jobsCount: entries.length,
      completedCount,
      scheduledCount: entries.length - completedCount,
      totalHours: `${entries.reduce((sum, entry) => sum + entry.hoursWorked, 0)}`,
      recentSite: entries[0]?.siteLabel ?? '--',
    };
  };
  readonly selectedHistoryLifecycleSummary = () => ({
    completedOnTime: 0,
    completedLate: 0,
    scheduledLate: 0,
    continuity: 0,
  });
  readonly startNextJobReadiness = this.readinessSignal.asReadonly();
  readonly clockSummaries = this.clockSignal.asReadonly();

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
    jobOptions?: EmployeeLoggedJobOption[];
    selectedHistoryEmployeeId?: string | null;
    historyEntries?: EmployeeJobHistoryRecord[];
    readiness?: EmployeeStartNextJobReadiness[];
    clockSummaries?: EmployeeClockSummary[];
    editingHoursEntryId?: string | null;
    hoursErrors?: string[];
    hoursSuccess?: string | null;
    editingHistoryEntryId?: string | null;
    historyErrors?: string[];
    historySuccess?: string | null;
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
    if (options.jobOptions) {
      this.jobOptionsSignal.set(options.jobOptions);
    }
    if (options.selectedHistoryEmployeeId !== undefined) {
      this.selectedHistoryEmployeeIdSignal.set(options.selectedHistoryEmployeeId);
    }
    if (options.historyEntries) {
      this.historyEntriesSignal.set(options.historyEntries);
    }
    if (options.readiness) {
      this.readinessSignal.set(options.readiness);
    }
    if (options.clockSummaries) {
      this.clockSignal.set(options.clockSummaries);
    }
    if (options.editingHoursEntryId !== undefined) {
      this.editingHoursEntryIdSignal.set(options.editingHoursEntryId);
    }
    if (options.hoursErrors) {
      this.hoursErrorsSignal.set(options.hoursErrors);
    }
    if (options.hoursSuccess !== undefined) {
      this.hoursSuccessSignal.set(options.hoursSuccess);
    }
    if (options.editingHistoryEntryId !== undefined) {
      this.editingHistoryEntryIdSignal.set(options.editingHistoryEntryId);
    }
    if (options.historyErrors) {
      this.historyErrorsSignal.set(options.historyErrors);
    }
    if (options.historySuccess !== undefined) {
      this.historySuccessSignal.set(options.historySuccess);
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
  source: 'manual',
  jobEntryId: 'job-entry-1',
  correctionNote: 'Crew finished earlier than estimate.',
  clockInAt: null,
  clockOutAt: null,
  updatedByRole: 'owner',
  updatedAt: '2026-03-20T17:30:00Z',
};

const manualHoursEntry: EmployeeHoursRecord = {
  ...hoursEntry,
  id: 'hours-2',
  siteLabel: 'Payroll correction',
  jobEntryId: null,
  correctionNote: 'Adjusted after missed clock-out.',
};

const loggedJobOption: EmployeeLoggedJobOption = {
  entryId: 'job-entry-1',
  clientName: 'CJ AbiNassif',
  siteLabel: 'Westmount',
  address: '1450 Pine Ave W',
  scheduledStart: '2026-03-20T13:00:00Z',
  scheduledEnd: '2026-03-20T17:00:00Z',
  status: 'late',
};

const historyEntry: EmployeeJobHistoryRecord = {
  id: 'history-1',
  employeeId: 'emp-1',
  siteLabel: 'Westmount Cedar Hedge',
  address: '1450 Pine Ave W',
  scheduledStart: '2026-03-20T13:00:00Z',
  scheduledEnd: '2026-03-20T17:00:00Z',
  hoursWorked: 8,
  status: 'completed',
};

const scheduledHistoryEntry: EmployeeJobHistoryRecord = {
  id: 'history-2',
  employeeId: 'emp-1',
  siteLabel: 'NDG Maple Court',
  address: '2331 Sherbrooke St W',
  scheduledStart: '2026-03-24T12:00:00Z',
  scheduledEnd: '2026-03-24T15:00:00Z',
  hoursWorked: 3,
  status: 'scheduled',
};

const readinessRecord: EmployeeStartNextJobReadiness = {
  employeeId: 'emp-1',
  fullName: 'Alex Karam',
  status: 'active',
  readinessState: 'available',
  scheduledJobsCount: 1,
  completedJobsCount: 1,
  scheduledHours: 3,
  completedHours: 8,
  nextScheduledStart: '2026-03-24T12:00:00Z',
  nextScheduledEnd: '2026-03-24T15:00:00Z',
  nextAvailableAt: '2026-03-21T10:00:00Z',
  lastCompletedAt: '2026-03-20T17:00:00Z',
  lastCompletedSite: 'Westmount Cedar Hedge',
  hasScheduleConflict: false,
  upcomingWindows: [
    {
      jobId: 'history-upcoming-1',
      siteLabel: 'NDG Maple Court',
      address: '2331 Sherbrooke St W',
      startAt: '2026-03-24T12:00:00Z',
      endAt: '2026-03-24T15:00:00Z',
    },
  ],
};

const clockSummaryRecord: EmployeeClockSummary = {
  employeeId: 'emp-1',
  fullName: 'Alex Karam',
  state: 'clocked_out',
  lastActivityAt: '2026-03-21T12:10:00Z',
  currentSiteLabel: 'Westmount',
  clockInAt: null,
  clockOutAt: '2026-03-21T12:00:00Z',
  lastDurationHours: '2',
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
    expect(native.textContent).toContain('Workspace mode');
  });

  it('renders loading, error, and empty states', () => {
    facade.setViewModel({ loadState: 'loading' });
    let fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.employees-roster .roster-state')?.textContent,
    ).toContain('Loading employee roster');

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
    expect(
      fixture.nativeElement.querySelector('.employees-roster .roster-state')?.textContent,
    ).toContain('No employees match this filter.');
  });

  it('forwards roster actions and role toggles', () => {
    facade.setViewModel({
      loadState: 'ready',
      role: 'owner',
      roster: [activeRecord],
      filteredRoster: [activeRecord],
      stats: { total: 1, active: 1, inactive: 0 },
      clockSummaries: [
        clockSummaryRecord,
        {
          ...clockSummaryRecord,
          employeeId: 'emp-2',
          fullName: 'Nora Bitar',
          state: 'clocked_in',
          clockInAt: '2026-03-21T13:00:00Z',
          clockOutAt: null,
          lastDurationHours: null,
        },
      ],
    });
    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();

    const native = fixture.nativeElement as HTMLElement;
    (native.querySelector('.add-btn') as HTMLButtonElement).click();
    expect(facade.openCreateProfile).toHaveBeenCalled();

    const roleButtons = native.querySelectorAll('.role-mode .status-pill');
    (roleButtons[1] as HTMLButtonElement).click();
    expect(facade.roleControl.value).toBe('manager');

    (native.querySelector('.employees-roster .employee-card') as HTMLElement).click();
    fixture.detectChanges();
    const employeeActions = native.querySelectorAll('.employee-card__actions .employee-action');
    (employeeActions[0] as HTMLButtonElement).click();
    (employeeActions[1] as HTMLButtonElement).click();
    (employeeActions[2] as HTMLButtonElement).click();
    (employeeActions[3] as HTMLButtonElement).click();
    expect(facade.openJobHistory).toHaveBeenCalledWith('emp-1');
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

    const workspaceButtons = native.querySelectorAll(
      '.employees-workspace .status-pill',
    ) as NodeListOf<HTMLButtonElement>;
    workspaceButtons[1]?.click();
    fixture.detectChanges();

    const clockButtons = native.querySelectorAll('.clock-card .employee-action');
    (clockButtons[0] as HTMLButtonElement).click();
    (clockButtons[3] as HTMLButtonElement).click();
    expect(facade.clockIn).toHaveBeenCalledWith('emp-1');
    expect(facade.clockOut).toHaveBeenCalledWith('emp-2');
  });

  it('renders restore action for inactive employees', () => {
    facade.setViewModel({
      loadState: 'ready',
      role: 'owner',
      roster: [inactiveRecord],
      filteredRoster: [inactiveRecord],
      stats: { total: 1, active: 0, inactive: 1 },
    });

    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    const native = fixture.nativeElement as HTMLElement;
    (native.querySelector('.employees-roster .employee-card') as HTMLElement).click();
    fixture.detectChanges();
    const actions = native.querySelectorAll(
      '.employee-card__actions .employee-action',
    ) as NodeListOf<HTMLButtonElement>;

    expect(actions[3]?.textContent).toContain('Restore');
    actions[3]?.click();
    expect(facade.restoreEmployee).toHaveBeenCalledWith('emp-2');
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

    const cards = native.querySelectorAll('.employee-card');
    (cards[0] as HTMLElement).click();
    fixture.detectChanges();
    const cardActions = native.querySelectorAll('.employee-card__actions');
    const firstEdit = cardActions[0]?.querySelectorAll('.employee-action')[2] as HTMLButtonElement;
    const firstArchive = cardActions[0]?.querySelectorAll(
      '.employee-action',
    )[3] as HTMLButtonElement;
    expect(firstEdit.disabled).toBe(true);
    expect(firstArchive.disabled).toBe(true);
  });

  it('renders profile editor states and forwards submit/cancel', () => {
    facade.setViewModel({ profileEditorOpen: false });
    let fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    (
      fixture.componentInstance as unknown as { setWorkspaceFocus: (focus: string) => void }
    ).setWorkspaceFocus('profile');
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
    (native.querySelector('.employees-roster .employee-card') as HTMLElement).click();
    fixture.detectChanges();
    const actions = native.querySelectorAll('.employee-card__actions .employee-action');
    (actions[2] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(native.querySelector('.error-summary')?.textContent).toContain('Fix the following');
    expect(native.querySelector('.employee-inline-panel h4')?.textContent).toContain(
      'Profile editor',
    );

    const closeButton = native.querySelector(
      '.employee-inline-panel__header .employee-action',
    ) as HTMLButtonElement;
    closeButton.click();
    expect(facade.cancelProfileEditor).toHaveBeenCalled();

    (actions[2] as HTMLButtonElement).click();
    fixture.detectChanges();
    const form = native.querySelector('.profile-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(facade.saveProfile).toHaveBeenCalled();
  });

  it('renders open profile form without error summary when no validation errors exist', () => {
    facade.setViewModel({
      loadState: 'ready',
      profileEditorOpen: true,
      profileEditorMode: 'create',
      profileErrors: [],
      roster: [activeRecord],
      filteredRoster: [activeRecord],
    });

    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    (
      fixture.componentInstance as unknown as { setWorkspaceFocus: (focus: string) => void }
    ).setWorkspaceFocus('profile');
    fixture.detectChanges();

    const native = fixture.nativeElement as HTMLElement;
    expect(native.querySelector('.profile-form')).toBeTruthy();
    expect(native.querySelector('.error-summary')).toBeNull();
  });

  it('renders hours editor states and forwards hours actions', () => {
    facade.setViewModel({
      loadState: 'ready',
      role: 'owner',
      roster: [activeRecord],
      filteredRoster: [activeRecord],
      selectedHoursEmployeeId: activeRecord.id,
      hoursEntries: [hoursEntry],
      jobOptions: [loggedJobOption],
      editingHoursEntryId: hoursEntry.id,
      hoursErrors: ['Required fields missing: Hours.'],
    });
    facade.hoursForm.patchValue({
      workDate: '2026-03-20',
      jobEntryId: '__manual__',
      correctionNote: 'Payroll correction',
      hours: '8',
    });

    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    const native = fixture.nativeElement as HTMLElement;
    (native.querySelector('.employees-roster .employee-card') as HTMLElement).click();
    fixture.detectChanges();
    const cardActions = native.querySelectorAll('.employee-card__actions .employee-action');
    (cardActions[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(native.querySelector('.employee-inline-panel h4')?.textContent).toContain(
      'Hours editor',
    );
    expect(native.querySelector('.hours-list .hours-card')).toBeTruthy();
    expect(native.querySelector('.hours-card__source-badge')?.textContent).toContain('Linked job');
    expect(native.querySelector('.hours-card__linked')?.textContent).toContain('CJ AbiNassif');
    expect(native.querySelector('.hours-card__slot')?.textContent).toContain('Scheduled:');
    expect(native.querySelector('.hours-card__note')?.textContent).toContain(
      'Crew finished earlier than estimate.',
    );
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

    const closeButton = native.querySelector(
      '.employee-inline-panel__header .employee-action',
    ) as HTMLButtonElement;
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
      hoursSuccess: 'Hours entry saved successfully.',
    });

    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    const native = fixture.nativeElement as HTMLElement;
    (native.querySelector('.employees-roster .employee-card') as HTMLElement).click();
    fixture.detectChanges();
    const cardActions = native.querySelectorAll('.employee-card__actions .employee-action');
    (cardActions[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(native.querySelector('.hours-list .hours-card')).toBeNull();
    expect(native.querySelector('.error-summary')).toBeNull();
    expect(native.querySelector('.workspace-notice--success')?.textContent).toContain(
      'Hours entry saved successfully.',
    );
    expect(native.querySelector('.hours-form button[type="submit"]')?.textContent).toContain(
      'Save hours',
    );
  });

  it('renders manual correction metadata in hours cards', () => {
    facade.setViewModel({
      loadState: 'ready',
      role: 'owner',
      roster: [activeRecord],
      filteredRoster: [activeRecord],
      selectedHoursEmployeeId: activeRecord.id,
      hoursEntries: [manualHoursEntry],
      editingHoursEntryId: null,
      hoursErrors: [],
    });

    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    const native = fixture.nativeElement as HTMLElement;
    (native.querySelector('.employees-roster .employee-card') as HTMLElement).click();
    fixture.detectChanges();
    const cardActions = native.querySelectorAll('.employee-card__actions .employee-action');
    (cardActions[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(native.querySelector('.hours-card__source-badge')?.textContent).toContain(
      'Manual correction',
    );
    expect(native.querySelector('.hours-card__note')?.textContent).toContain(
      'Adjusted after missed clock-out.',
    );
    expect(native.querySelector('.hours-card__linked')).toBeNull();
  });

  it('renders history timeline and forwards close action', () => {
    facade.setViewModel({
      loadState: 'ready',
      roster: [activeRecord],
      filteredRoster: [activeRecord],
      selectedHistoryEmployeeId: activeRecord.id,
      historyEntries: [historyEntry],
    });

    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    const native = fixture.nativeElement as HTMLElement;
    (native.querySelector('.employees-roster .employee-card') as HTMLElement).click();
    fixture.detectChanges();
    const cardActions = native.querySelectorAll('.employee-card__actions .employee-action');
    (cardActions[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(native.querySelector('.employee-inline-panel h4')?.textContent).toContain(
      'Job history timeline',
    );
    expect(native.querySelector('.history-list .history-card')).toBeTruthy();
    expect(native.querySelector('.employee-inline-panel__meta')).toBeTruthy();

    const closeButton = native.querySelector(
      '.employee-inline-panel__header .employee-action',
    ) as HTMLButtonElement;
    closeButton.click();
    expect(facade.closeJobHistory).toHaveBeenCalled();
  });

  it('renders scheduled history status chip branch', () => {
    facade.setViewModel({
      loadState: 'ready',
      roster: [activeRecord],
      filteredRoster: [activeRecord],
      selectedHistoryEmployeeId: activeRecord.id,
      historyEntries: [scheduledHistoryEntry],
    });

    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    const native = fixture.nativeElement as HTMLElement;
    (native.querySelector('.employees-roster .employee-card') as HTMLElement).click();
    fixture.detectChanges();
    const cardActions = native.querySelectorAll('.employee-card__actions .employee-action');
    (cardActions[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(native.querySelector('.history-card .status-chip')?.textContent).toContain('Scheduled');
    const editSchedule = native.querySelector(
      '.history-card__actions .employee-action',
    ) as HTMLButtonElement;
    editSchedule.click();
    expect(facade.startHistoryEdit).toHaveBeenCalledWith('history-2');
  });

  it('renders inline history editor and forwards save/cancel actions', () => {
    facade.setViewModel({
      loadState: 'ready',
      roster: [activeRecord],
      filteredRoster: [activeRecord],
      selectedHistoryEmployeeId: activeRecord.id,
      historyEntries: [scheduledHistoryEntry],
      editingHistoryEntryId: scheduledHistoryEntry.id,
      historyErrors: ['Scheduled end must be later than scheduled start.'],
      historySuccess: 'History schedule updated successfully.',
    });
    facade.historyForm.setValue({
      siteLabel: 'NDG Maple Court',
      address: '2331 Sherbrooke St W',
      scheduledStart: '2026-03-24T08:00',
      scheduledEnd: '2026-03-24T10:00',
    });

    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    const native = fixture.nativeElement as HTMLElement;
    (native.querySelector('.employees-roster .employee-card') as HTMLElement).click();
    fixture.detectChanges();
    const cardActions = native.querySelectorAll('.employee-card__actions .employee-action');
    (cardActions[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(native.querySelector('.history-form')).toBeTruthy();
    expect(native.querySelector('.error-summary')?.textContent).toContain(
      'Fix the following before saving history edits',
    );
    expect(native.querySelector('.success-summary')?.textContent).toContain(
      'History schedule updated successfully.',
    );

    const historyForm = native.querySelector('.history-form') as HTMLFormElement;
    historyForm.dispatchEvent(new Event('submit'));
    expect(facade.saveHistoryEdit).toHaveBeenCalled();

    const cancelButton = native.querySelector(
      '.history-form .employee-action',
    ) as HTMLButtonElement;
    cancelButton.click();
    expect(facade.cancelHistoryEdit).toHaveBeenCalled();
  });

  it('shows empty history state when selected employee has no timeline entries', () => {
    facade.setViewModel({
      loadState: 'ready',
      roster: [activeRecord],
      filteredRoster: [activeRecord],
      selectedHistoryEmployeeId: activeRecord.id,
      historyEntries: [],
    });

    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    const native = fixture.nativeElement as HTMLElement;
    (native.querySelector('.employees-roster .employee-card') as HTMLElement).click();
    fixture.detectChanges();
    const cardActions = native.querySelectorAll('.employee-card__actions .employee-action');
    (cardActions[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(native.querySelector('.employee-inline-panel .roster-state')?.textContent).toContain(
      'No job history found for this employee yet.',
    );
  });

  it('renders readiness contract cards and uses readiness trackBy', () => {
    facade.setViewModel({
      loadState: 'ready',
      roster: [activeRecord],
      filteredRoster: [activeRecord],
      readiness: [readinessRecord],
    });

    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    const native = fixture.nativeElement as HTMLElement;

    const workspaceButtons = native.querySelectorAll(
      '.employees-workspace .status-pill',
    ) as NodeListOf<HTMLButtonElement>;
    workspaceButtons[2]?.click();
    fixture.detectChanges();

    expect(native.querySelector('.employees-readiness h2')?.textContent).toContain(
      'Assignment data contract preview',
    );
    expect(native.querySelector('.readiness-card__header h3')?.textContent).toContain('Alex Karam');
    expect(native.querySelector('.readiness-card__meta')?.textContent).toContain(
      'Scheduled jobs: 1',
    );
    expect(facade.trackByReadinessEmployeeId).toHaveBeenCalled();
  });

  it('renders scheduled/inactive readiness fallbacks and conflict notice', () => {
    facade.setViewModel({
      loadState: 'ready',
      roster: [activeRecord],
      filteredRoster: [activeRecord],
      readiness: [
        {
          ...readinessRecord,
          readinessState: 'scheduled',
          nextAvailableAt: null,
          lastCompletedSite: null,
          hasScheduleConflict: true,
        },
        {
          ...readinessRecord,
          employeeId: 'emp-2',
          fullName: 'Nora Bitar',
          readinessState: 'inactive',
          nextScheduledStart: null,
          nextAvailableAt: null,
          lastCompletedSite: null,
          hasScheduleConflict: false,
        },
      ],
    });

    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();
    const native = fixture.nativeElement as HTMLElement;

    const workspaceButtons = native.querySelectorAll(
      '.employees-workspace .status-pill',
    ) as NodeListOf<HTMLButtonElement>;
    workspaceButtons[2]?.click();
    fixture.detectChanges();

    const readinessCards = native.querySelectorAll('.readiness-card');
    expect(readinessCards.length).toBe(2);
    expect(readinessCards[0]?.textContent).toContain('On scheduled work');
    expect(readinessCards[0]?.textContent).toContain('Next available:');
    expect(readinessCards[0]?.textContent).toContain('Last completed site:');
    expect(readinessCards[0]?.querySelector('.readiness-card__conflict')?.textContent).toContain(
      'Schedule conflict detected',
    );
    expect(readinessCards[1]?.textContent).toContain('Inactive');
  });
});
