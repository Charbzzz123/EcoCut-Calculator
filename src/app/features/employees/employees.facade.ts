import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs';
import { EmployeesDataService } from './employees-data.service.js';
import type {
  EmployeeEditorMode,
  EmployeeHoursMutationPayload,
  EmployeeHoursDraft,
  EmployeeHoursRecord,
  EmployeeHoursSource,
  EmployeeLoggedJobOption,
  EmployeeJobHistoryRecord,
  EmployeeLoadState,
  EmployeeOperatorRole,
  EmployeeProfileMutationPayload,
  EmployeeProfileDraft,
  EmployeeStartNextJobReadiness,
  EmployeeRosterRecord,
  EmployeeStatusFilter,
} from './employees.types.js';

const digitsOnly = (value: string): string => value.replace(/\D/g, '');
const normalizeText = (value: string): string => value.trim().toLowerCase();
const normalizeName = (firstName: string, lastName: string): string =>
  `${normalizeText(firstName)}|${normalizeText(lastName)}`;
const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);
const formatHours = (hours: number): string =>
  Number.isInteger(hours) ? `${hours}` : hours.toFixed(2).replace(/\.?0+$/, '');
const sortHoursByDateDesc = (left: EmployeeHoursRecord, right: EmployeeHoursRecord): number => {
  if (left.workDate === right.workDate) {
    return right.updatedAt.localeCompare(left.updatedAt);
  }
  return right.workDate.localeCompare(left.workDate);
};
const sortByUpdatedAtDesc = (left: EmployeeHoursRecord, right: EmployeeHoursRecord): number =>
  right.updatedAt.localeCompare(left.updatedAt);
const sortHistoryByStartDesc = (
  left: EmployeeJobHistoryRecord,
  right: EmployeeJobHistoryRecord,
): number => right.scheduledStart.localeCompare(left.scheduledStart);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\(\d{3}\)\s\d{3}-\d{4}$/;

type EmployeeClockState = 'clocked_in' | 'clocked_out' | 'inactive';

export interface EmployeeClockSummary {
  employeeId: string;
  fullName: string;
  state: EmployeeClockState;
  lastActivityAt: string | null;
  currentSiteLabel: string | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  lastDurationHours: string | null;
}

@Injectable({ providedIn: 'root' })
export class EmployeesFacade {
  private readonly data = inject(EmployeesDataService);

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
    workDate: new FormControl(toIsoDate(new Date()), { nonNullable: true }),
    jobEntryId: new FormControl('', { nonNullable: true }),
    siteLabel: new FormControl('', { nonNullable: true }),
    hours: new FormControl('', { nonNullable: true }),
  });

  private readonly querySignal: WritableSignal<string> = signal('');
  private readonly statusFilterSignal: WritableSignal<EmployeeStatusFilter> =
    signal<EmployeeStatusFilter>('all');
  private readonly rosterSignal: WritableSignal<EmployeeRosterRecord[]> = signal<
    EmployeeRosterRecord[]
  >([]);
  private readonly loadStateSignal: WritableSignal<EmployeeLoadState> =
    signal<EmployeeLoadState>('loading');
  private readonly roleSignal: WritableSignal<EmployeeOperatorRole> =
    signal<EmployeeOperatorRole>('owner');
  private readonly profileEditorOpenSignal: WritableSignal<boolean> = signal(false);
  private readonly profileEditorModeSignal: WritableSignal<EmployeeEditorMode> =
    signal<EmployeeEditorMode>('create');
  private readonly editingEmployeeIdSignal: WritableSignal<string | null> = signal<string | null>(
    null,
  );
  private readonly profileErrorsSignal: WritableSignal<string[]> = signal<string[]>([]);
  private readonly hoursEntriesSignal: WritableSignal<EmployeeHoursRecord[]> = signal<
    EmployeeHoursRecord[]
  >([]);
  private readonly jobHistoryEntriesSignal: WritableSignal<EmployeeJobHistoryRecord[]> = signal<
    EmployeeJobHistoryRecord[]
  >([]);
  private readonly jobOptionsSignal: WritableSignal<EmployeeLoggedJobOption[]> = signal<
    EmployeeLoggedJobOption[]
  >([]);
  private readonly startNextJobReadinessSignal: WritableSignal<EmployeeStartNextJobReadiness[]> =
    signal<EmployeeStartNextJobReadiness[]>([]);
  private readonly selectedHoursEmployeeIdSignal: WritableSignal<string | null> = signal<
    string | null
  >(null);
  private readonly selectedHistoryEmployeeIdSignal: WritableSignal<string | null> = signal<
    string | null
  >(null);
  private readonly editingHoursEntryIdSignal: WritableSignal<string | null> = signal<string | null>(
    null,
  );
  private readonly hoursErrorsSignal: WritableSignal<string[]> = signal<string[]>([]);
  private readonly hoursSuccessSignal: WritableSignal<string | null> = signal<string | null>(null);
  private readonly workspaceNoticeSignal: WritableSignal<string | null> = signal<string | null>(
    null,
  );

  readonly statusFilter: Signal<EmployeeStatusFilter> = this.statusFilterSignal.asReadonly();
  readonly loadState: Signal<EmployeeLoadState> = this.loadStateSignal.asReadonly();
  readonly operatorRole: Signal<EmployeeOperatorRole> = this.roleSignal.asReadonly();
  readonly isOwner: Signal<boolean> = computed(() => this.roleSignal() === 'owner');
  readonly canEditExistingProfiles: Signal<boolean> = computed(() => this.isOwner());
  readonly canArchiveProfiles: Signal<boolean> = computed(() => this.isOwner());
  readonly workspaceNotice: Signal<string | null> = this.workspaceNoticeSignal.asReadonly();
  readonly filteredRoster: Signal<EmployeeRosterRecord[]> = computed(() =>
    this.filterRoster(this.rosterSignal(), this.querySignal(), this.statusFilterSignal()),
  );
  readonly stats: Signal<{ total: number; active: number; inactive: number }> = computed(() =>
    this.computeStats(this.rosterSignal()),
  );
  readonly profileEditorOpen: Signal<boolean> = this.profileEditorOpenSignal.asReadonly();
  readonly profileEditorMode: Signal<EmployeeEditorMode> =
    this.profileEditorModeSignal.asReadonly();
  readonly editingEmployeeId: Signal<string | null> = this.editingEmployeeIdSignal.asReadonly();
  readonly profileErrors: Signal<string[]> = this.profileErrorsSignal.asReadonly();
  readonly activeEmployee: Signal<EmployeeRosterRecord | null> = computed(() => {
    const editingId = this.editingEmployeeIdSignal();
    if (!editingId) {
      return null;
    }
    return this.rosterSignal().find((employee) => employee.id === editingId) ?? null;
  });
  readonly hoursEditorOpen: Signal<boolean> = computed(
    () => this.selectedHoursEmployeeIdSignal() !== null,
  );
  readonly selectedHoursEmployee: Signal<EmployeeRosterRecord | null> = computed(() => {
    const selectedId = this.selectedHoursEmployeeIdSignal();
    if (!selectedId) {
      return null;
    }
    return this.rosterSignal().find((employee) => employee.id === selectedId) ?? null;
  });
  readonly selectedHoursEntries: Signal<EmployeeHoursRecord[]> = computed(() => {
    const selectedId = this.selectedHoursEmployeeIdSignal();
    if (!selectedId) {
      return [];
    }
    const entries = this.hoursEntriesSignal().filter((entry) => entry.employeeId === selectedId);
    entries.sort(sortHoursByDateDesc);
    return entries;
  });
  readonly selectedHoursTotals: Signal<{
    totalHours: string;
    entryCount: number;
    lastUpdated: string;
  }> = computed(() => {
    const entries = this.selectedHoursEntries();
    const total = entries.reduce((sum, entry) => sum + entry.hours, 0);
    return {
      totalHours: formatHours(total),
      entryCount: entries.length,
      lastUpdated: entries[0]?.updatedAt ?? '--',
    };
  });
  readonly editingHoursEntry: Signal<EmployeeHoursRecord | null> = computed(() => {
    const editingId = this.editingHoursEntryIdSignal();
    if (!editingId) {
      return null;
    }
    return this.selectedHoursEntries().find((entry) => entry.id === editingId) ?? null;
  });
  readonly hoursErrors: Signal<string[]> = this.hoursErrorsSignal.asReadonly();
  readonly hoursSuccess: Signal<string | null> = this.hoursSuccessSignal.asReadonly();
  readonly loggedJobOptions: Signal<EmployeeLoggedJobOption[]> = this.jobOptionsSignal.asReadonly();
  readonly selectedHoursJobOption: Signal<EmployeeLoggedJobOption | null> = computed(() => {
    const selectedEntryId = this.hoursForm.controls.jobEntryId.value;
    if (!selectedEntryId) {
      return null;
    }
    return this.jobOptionsSignal().find((option) => option.entryId === selectedEntryId) ?? null;
  });
  readonly historyPanelOpen: Signal<boolean> = computed(
    () => this.selectedHistoryEmployeeIdSignal() !== null,
  );
  readonly selectedHistoryEmployee: Signal<EmployeeRosterRecord | null> = computed(() => {
    const selectedId = this.selectedHistoryEmployeeIdSignal();
    if (!selectedId) {
      return null;
    }
    return this.rosterSignal().find((employee) => employee.id === selectedId) ?? null;
  });
  readonly selectedEmployeeJobHistory: Signal<EmployeeJobHistoryRecord[]> = computed(() => {
    const selectedId = this.selectedHistoryEmployeeIdSignal();
    if (!selectedId) {
      return [];
    }
    const entries = this.jobHistoryEntriesSignal().filter(
      (entry) => entry.employeeId === selectedId,
    );
    entries.sort(sortHistoryByStartDesc);
    return entries;
  });
  readonly selectedHistorySummary: Signal<{
    jobsCount: number;
    completedCount: number;
    scheduledCount: number;
    totalHours: string;
    recentSite: string;
  }> = computed(() => {
    const entries = this.selectedEmployeeJobHistory();
    const completedCount = entries.filter((entry) => entry.status === 'completed').length;
    const scheduledCount = entries.length - completedCount;
    const recentSite = entries[0]?.siteLabel ?? '--';
    const totalHours = entries.reduce((sum, entry) => sum + entry.hoursWorked, 0);
    return {
      jobsCount: entries.length,
      completedCount,
      scheduledCount,
      totalHours: formatHours(totalHours),
      recentSite,
    };
  });
  readonly startNextJobReadiness: Signal<EmployeeStartNextJobReadiness[]> =
    this.startNextJobReadinessSignal.asReadonly();
  readonly clockSummaries: Signal<EmployeeClockSummary[]> = computed(() =>
    this.computeClockSummaries(this.rosterSignal(), this.hoursEntriesSignal()),
  );

  constructor() {
    this.queryControl.valueChanges
      .pipe(startWith(''), debounceTime(150), distinctUntilChanged())
      .subscribe((value) => this.querySignal.set(value));

    this.roleControl.valueChanges
      .pipe(startWith(this.roleControl.value), distinctUntilChanged())
      .subscribe((value) => this.roleSignal.set(value));
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

  profileErrorsSnapshot(): string[] {
    return this.profileErrors();
  }

  selectedHoursEntriesSnapshot(): EmployeeHoursRecord[] {
    return this.selectedHoursEntries();
  }

  hoursErrorsSnapshot(): string[] {
    return this.hoursErrors();
  }

  hoursSuccessSnapshot(): string | null {
    return this.hoursSuccess();
  }

  selectedEmployeeJobHistorySnapshot(): EmployeeJobHistoryRecord[] {
    return this.selectedEmployeeJobHistory();
  }

  startNextJobReadinessSnapshot(): EmployeeStartNextJobReadiness[] {
    return this.startNextJobReadiness();
  }

  clockSummariesSnapshot(): EmployeeClockSummary[] {
    return this.clockSummaries();
  }

  openCreateProfile(): void {
    this.clearWorkspaceNotice();
    this.profileEditorOpenSignal.set(true);
    this.profileEditorModeSignal.set('create');
    this.editingEmployeeIdSignal.set(null);
    this.profileErrorsSignal.set([]);
    this.profileForm.setValue({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      role: '',
      hourlyRate: '',
      notes: '',
    });
    this.profileForm.markAsPristine();
    this.profileForm.markAsUntouched();
  }

  openEditProfile(employeeId: string): void {
    this.clearWorkspaceNotice();
    if (!this.canEditExistingProfiles()) {
      this.workspaceNoticeSignal.set(
        'Manager mode can add employees and edit hours only. Switch to Owner mode to edit employee profiles.',
      );
      return;
    }

    const employee = this.rosterSignal().find((record) => record.id === employeeId);
    if (!employee) {
      return;
    }
    this.profileEditorOpenSignal.set(true);
    this.profileEditorModeSignal.set('edit');
    this.editingEmployeeIdSignal.set(employee.id);
    this.profileErrorsSignal.set([]);
    this.profileForm.setValue({
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone,
      email: employee.email ?? '',
      role: employee.role,
      hourlyRate: employee.hourlyRate.toFixed(2),
      notes: employee.notes,
    });
    this.profileForm.markAsPristine();
    this.profileForm.markAsUntouched();
  }

  cancelProfileEditor(): void {
    this.profileEditorOpenSignal.set(false);
    this.profileEditorModeSignal.set('create');
    this.editingEmployeeIdSignal.set(null);
    this.profileErrorsSignal.set([]);
  }

  async saveProfile(): Promise<boolean> {
    this.clearWorkspaceNotice();
    if (this.profileEditorModeSignal() === 'edit' && !this.canEditExistingProfiles()) {
      this.profileErrorsSignal.set([
        'Manager mode cannot update existing profiles. Switch to Owner mode for profile edits.',
      ]);
      return false;
    }

    const draft = this.readDraftFromForm();
    const validationErrors = this.validateDraft(draft);
    if (validationErrors.length) {
      this.profileErrorsSignal.set(validationErrors);
      return false;
    }

    const payload = this.toProfileMutationPayload(draft);
    try {
      if (this.profileEditorModeSignal() === 'create') {
        await this.data.createEmployeeProfile(payload, this.roleSignal());
      } else {
        const editingId = this.editingEmployeeIdSignal();
        if (!editingId) {
          this.profileErrorsSignal.set(['Unable to resolve the employee profile being edited.']);
          return false;
        }
        await this.data.updateEmployeeProfile(editingId, payload, this.roleSignal());
      }

      this.cancelProfileEditor();
      await this.loadRoster();
      return true;
    } catch (error) {
      this.profileErrorsSignal.set([
        this.readApiErrorMessage(error, 'Unable to save employee profile.'),
      ]);
      return false;
    }
  }

  async archiveEmployee(employeeId: string): Promise<void> {
    this.clearWorkspaceNotice();
    if (!this.canArchiveProfiles()) {
      this.workspaceNoticeSignal.set(
        'Manager mode cannot archive employees. Switch to Owner mode for archive actions.',
      );
      return;
    }
    try {
      await this.data.archiveEmployee(employeeId, this.roleSignal());
      await this.loadRoster();
    } catch (error) {
      this.workspaceNoticeSignal.set(
        this.readApiErrorMessage(error, 'Unable to archive employee.'),
      );
    }
  }

  async restoreEmployee(employeeId: string): Promise<void> {
    this.clearWorkspaceNotice();
    if (!this.canArchiveProfiles()) {
      this.workspaceNoticeSignal.set(
        'Manager mode cannot restore employees. Switch to Owner mode for restore actions.',
      );
      return;
    }
    try {
      await this.data.restoreEmployee(employeeId, this.roleSignal());
      await this.loadRoster();
    } catch (error) {
      this.workspaceNoticeSignal.set(
        this.readApiErrorMessage(error, 'Unable to restore employee.'),
      );
    }
  }

  openHoursEditor(employeeId: string): void {
    this.clearWorkspaceNotice();
    const employee = this.rosterSignal().find((record) => record.id === employeeId);
    if (!employee) {
      return;
    }

    this.selectedHoursEmployeeIdSignal.set(employee.id);
    this.editingHoursEntryIdSignal.set(null);
    this.hoursErrorsSignal.set([]);
    this.hoursSuccessSignal.set(null);
    this.hoursForm.setValue({
      workDate: toIsoDate(new Date()),
      jobEntryId: '',
      siteLabel: '',
      hours: '',
    });
  }

  openJobHistory(employeeId: string): void {
    this.clearWorkspaceNotice();
    const employee = this.rosterSignal().find((record) => record.id === employeeId);
    if (!employee) {
      return;
    }
    this.selectedHistoryEmployeeIdSignal.set(employee.id);
  }

  closeJobHistory(): void {
    this.selectedHistoryEmployeeIdSignal.set(null);
  }

  closeHoursEditor(): void {
    this.selectedHoursEmployeeIdSignal.set(null);
    this.editingHoursEntryIdSignal.set(null);
    this.hoursErrorsSignal.set([]);
    this.hoursSuccessSignal.set(null);
  }

  editHoursEntry(entryId: string): void {
    this.clearWorkspaceNotice();
    const entry = this.selectedHoursEntries().find((record) => record.id === entryId);
    if (!entry) {
      return;
    }
    this.editingHoursEntryIdSignal.set(entry.id);
    this.hoursErrorsSignal.set([]);
    this.hoursSuccessSignal.set(null);
    this.hoursForm.setValue({
      workDate: entry.workDate,
      jobEntryId: entry.jobEntryId ?? '',
      siteLabel: entry.siteLabel,
      hours: formatHours(entry.hours),
    });
  }

  async removeHoursEntry(entryId: string): Promise<void> {
    this.clearWorkspaceNotice();
    try {
      await this.data.removeHoursEntry(entryId, this.roleSignal());
      if (this.editingHoursEntryIdSignal() === entryId) {
        this.editingHoursEntryIdSignal.set(null);
        this.hoursForm.patchValue({ jobEntryId: '', siteLabel: '', hours: '' });
      }
      this.hoursSuccessSignal.set('Hours entry removed.');
      await this.loadRoster();
    } catch (error) {
      this.hoursSuccessSignal.set(null);
      this.hoursErrorsSignal.set([
        this.readApiErrorMessage(error, 'Unable to remove hours entry.'),
      ]);
    }
  }

  async saveHoursEntry(): Promise<boolean> {
    this.clearWorkspaceNotice();
    const selectedEmployee = this.selectedHoursEmployee();
    if (!selectedEmployee) {
      this.hoursSuccessSignal.set(null);
      this.hoursErrorsSignal.set(['Select an employee before editing hours.']);
      return false;
    }

    try {
      const draft = this.readHoursDraftFromForm();
      const errors = this.validateHoursDraft(draft);
      if (errors.length) {
        this.hoursSuccessSignal.set(null);
        this.hoursErrorsSignal.set(errors);
        return false;
      }

      const payload = this.toHoursMutationPayload(selectedEmployee.id, draft);
      const editingId = this.editingHoursEntryIdSignal();
      let savedEntry: EmployeeHoursRecord;
      if (editingId) {
        savedEntry = await this.data.updateHoursEntry(
          editingId,
          {
            workDate: payload.workDate,
            siteLabel: payload.siteLabel,
            jobEntryId: payload.jobEntryId ?? null,
            hours: payload.hours,
          },
          this.roleSignal(),
        );
        this.hoursEntriesSignal.update((entries) =>
          entries.map((entry) => (entry.id === savedEntry.id ? savedEntry : entry)),
        );
      } else {
        savedEntry = await this.data.createHoursEntry(payload, this.roleSignal());
        this.hoursEntriesSignal.update((entries) => [savedEntry, ...entries]);
      }
      const now = new Date().toISOString();
      this.rosterSignal.update((roster) =>
        roster.map((record) =>
          record.id === selectedEmployee.id ? { ...record, lastActivityAt: now } : record,
        ),
      );

      this.editingHoursEntryIdSignal.set(null);
      this.hoursErrorsSignal.set([]);
      this.hoursSuccessSignal.set(
        editingId ? 'Hours entry updated successfully.' : 'Hours entry saved successfully.',
      );
      this.hoursForm.patchValue({ jobEntryId: '', siteLabel: '', hours: '' });
      await this.loadRoster();
      return true;
    } catch (error) {
      this.hoursSuccessSignal.set(null);
      this.hoursErrorsSignal.set([this.readApiErrorMessage(error, 'Unable to save hours entry.')]);
      return false;
    }
  }

  async clockIn(employeeId: string): Promise<boolean> {
    this.clearWorkspaceNotice();
    try {
      await this.data.recordClockAction(
        {
          employeeId,
          action: 'clock_in',
        },
        this.roleSignal(),
      );
      await this.loadRoster();
      return true;
    } catch (error) {
      this.workspaceNoticeSignal.set(
        this.readApiErrorMessage(error, 'Unable to clock in employee.'),
      );
      return false;
    }
  }

  async clockOut(employeeId: string): Promise<boolean> {
    this.clearWorkspaceNotice();
    try {
      await this.data.recordClockAction(
        {
          employeeId,
          action: 'clock_out',
        },
        this.roleSignal(),
      );
      await this.loadRoster();
      return true;
    } catch (error) {
      this.workspaceNoticeSignal.set(
        this.readApiErrorMessage(error, 'Unable to clock out employee.'),
      );
      return false;
    }
  }

  trackByEmployeeId = (_: number, employee: EmployeeRosterRecord): string => employee.id;

  trackByHoursEntryId = (_: number, entry: EmployeeHoursRecord): string => entry.id;

  trackByHistoryEntryId = (_: number, entry: EmployeeJobHistoryRecord): string => entry.id;

  trackByReadinessEmployeeId = (_: number, entry: EmployeeStartNextJobReadiness): string =>
    entry.employeeId;
  trackByClockEmployeeId = (_: number, entry: EmployeeClockSummary): string => entry.employeeId;

  async loadRoster(): Promise<void> {
    this.loadStateSignal.set('loading');
    try {
      const [roster, hours, history, readiness, jobOptions] = await Promise.all([
        this.data.listEmployees(),
        this.data.listHoursEntries(),
        this.data.listJobHistoryEntries(),
        this.data.listStartNextJobReadiness(),
        this.data.listLoggedJobOptions(),
      ]);
      this.rosterSignal.set(roster);
      this.hoursEntriesSignal.set(hours);
      this.jobHistoryEntriesSignal.set(history);
      this.startNextJobReadinessSignal.set(readiness);
      this.jobOptionsSignal.set(jobOptions);
      this.loadStateSignal.set('ready');
    } catch (error) {
      console.warn('Failed to load employee roster', error);
      this.jobOptionsSignal.set([]);
      this.startNextJobReadinessSignal.set([]);
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

  private computeClockSummaries(
    roster: EmployeeRosterRecord[],
    hoursEntries: EmployeeHoursRecord[],
  ): EmployeeClockSummary[] {
    return roster
      .map((employee) => {
        const employeeClockEntries = hoursEntries
          .filter((entry) => entry.employeeId === employee.id && this.isClockSource(entry.source))
          .sort(sortByUpdatedAtDesc);
        const openClockSession =
          employeeClockEntries.find((entry) => Boolean(entry.clockInAt) && !entry.clockOutAt) ??
          null;
        const latestClockSession = employeeClockEntries[0] ?? null;

        const state: EmployeeClockState =
          employee.status === 'inactive'
            ? 'inactive'
            : openClockSession
              ? 'clocked_in'
              : 'clocked_out';

        const durationHours =
          latestClockSession && latestClockSession.clockOutAt
            ? formatHours(latestClockSession.hours)
            : null;

        return {
          employeeId: employee.id,
          fullName: employee.fullName,
          state,
          lastActivityAt: employee.lastActivityAt,
          currentSiteLabel: openClockSession?.siteLabel ?? latestClockSession?.siteLabel ?? null,
          clockInAt: openClockSession?.clockInAt ?? null,
          clockOutAt: latestClockSession?.clockOutAt ?? null,
          lastDurationHours: durationHours,
        } satisfies EmployeeClockSummary;
      })
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
  }

  private readDraftFromForm(): EmployeeProfileDraft {
    return {
      firstName: this.profileForm.controls.firstName.value,
      lastName: this.profileForm.controls.lastName.value,
      phone: this.profileForm.controls.phone.value,
      email: this.profileForm.controls.email.value,
      role: this.profileForm.controls.role.value,
      hourlyRate: this.profileForm.controls.hourlyRate.value,
      notes: this.profileForm.controls.notes.value,
    };
  }

  private validateDraft(draft: EmployeeProfileDraft): string[] {
    const errors: string[] = [];
    const missingLabels: string[] = [];
    if (!draft.firstName.trim()) {
      missingLabels.push('First name');
    }
    if (!draft.lastName.trim()) {
      missingLabels.push('Last name');
    }
    if (!draft.phone.trim()) {
      missingLabels.push('Phone');
    }
    if (!draft.role.trim()) {
      missingLabels.push('Role');
    }
    if (!draft.hourlyRate.trim()) {
      missingLabels.push('Hourly rate');
    }

    if (missingLabels.length) {
      errors.push(`Required fields missing: ${missingLabels.join(', ')}.`);
    }

    const trimmedPhone = draft.phone.trim();
    if (trimmedPhone && !phonePattern.test(trimmedPhone)) {
      errors.push('Phone must use format (###) ###-####.');
    }

    const trimmedEmail = draft.email.trim();
    if (trimmedEmail && !emailPattern.test(trimmedEmail)) {
      errors.push('Email must be a valid address.');
    }

    const parsedRate = Number.parseFloat(draft.hourlyRate.trim());
    if (draft.hourlyRate.trim() && (!Number.isFinite(parsedRate) || parsedRate <= 0)) {
      errors.push('Hourly rate must be greater than 0.');
    }

    const duplicate = this.findDuplicate(draft);
    if (duplicate) {
      errors.push(
        `Duplicate employee detected (${duplicate.fullName}). Update the existing profile instead.`,
      );
    }

    return errors;
  }

  private findDuplicate(draft: EmployeeProfileDraft): EmployeeRosterRecord | null {
    const editingId = this.editingEmployeeIdSignal();
    const targetEmail = normalizeText(draft.email);
    const targetPhone = digitsOnly(draft.phone);
    const targetName = normalizeName(draft.firstName, draft.lastName);

    for (const employee of this.rosterSignal()) {
      if (editingId && employee.id === editingId) {
        continue;
      }

      const hasEmailMatch =
        Boolean(targetEmail) && normalizeText(employee.email ?? '') === targetEmail;
      const hasNamePhoneMatch =
        Boolean(targetPhone) &&
        digitsOnly(employee.phone) === targetPhone &&
        normalizeName(employee.firstName, employee.lastName) === targetName;
      if (hasEmailMatch || hasNamePhoneMatch) {
        return employee;
      }
    }

    return null;
  }

  private toProfileMutationPayload(draft: EmployeeProfileDraft): EmployeeProfileMutationPayload {
    return {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim() || undefined,
      role: draft.role.trim(),
      hourlyRate: Number.parseFloat(draft.hourlyRate.trim()),
      notes: draft.notes.trim() || undefined,
    };
  }

  private readHoursDraftFromForm(): EmployeeHoursDraft {
    return {
      workDate: this.hoursForm.controls.workDate.value,
      jobEntryId: this.hoursForm.controls.jobEntryId.value,
      siteLabel: this.hoursForm.controls.siteLabel.value,
      hours: this.hoursForm.controls.hours.value as string | number,
    };
  }

  private validateHoursDraft(draft: EmployeeHoursDraft): string[] {
    const errors: string[] = [];
    const missingLabels: string[] = [];
    const normalizedHours = this.normalizeHoursInput(draft.hours).trim();
    const hasLinkedJob = draft.jobEntryId.trim().length > 0;
    const linkedJobExists = hasLinkedJob
      ? this.jobOptionsSignal().some((option) => option.entryId === draft.jobEntryId)
      : false;
    if (!draft.workDate.trim()) {
      missingLabels.push('Work date');
    }
    if (!hasLinkedJob && !draft.siteLabel.trim()) {
      missingLabels.push('Site / address');
    }
    if (!normalizedHours) {
      missingLabels.push('Hours');
    }
    if (missingLabels.length) {
      errors.push(`Required fields missing: ${missingLabels.join(', ')}.`);
    }
    if (hasLinkedJob && !linkedJobExists) {
      errors.push('Selected linked job is unavailable. Refresh roster and try again.');
    }

    const parsedHours = Number.parseFloat(normalizedHours);
    if (
      normalizedHours &&
      (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 24)
    ) {
      errors.push('Hours must be a number greater than 0 and less than or equal to 24.');
    }

    return errors;
  }

  private toHoursMutationPayload(
    employeeId: string,
    draft: EmployeeHoursDraft,
  ): EmployeeHoursMutationPayload {
    const normalizedHours = this.normalizeHoursInput(draft.hours).trim();
    const linkedJob = this.jobOptionsSignal().find((option) => option.entryId === draft.jobEntryId);
    const manualSiteLabel = draft.siteLabel.trim();
    return {
      employeeId,
      workDate: draft.workDate.trim(),
      siteLabel: linkedJob ? undefined : manualSiteLabel,
      jobEntryId: linkedJob?.entryId,
      hours: Number.parseFloat(normalizedHours),
    };
  }

  private normalizeHoursInput(value: string | number): string {
    return typeof value === 'number' ? `${value}` : value;
  }

  private readApiErrorMessage(error: unknown, fallback: string): string {
    const message = this.readErrorPayloadMessage(error);
    return message ?? fallback;
  }

  private readErrorPayloadMessage(error: unknown): string | null {
    if (!error || typeof error !== 'object') {
      return null;
    }
    const payload = error as { error?: unknown; message?: unknown };
    const nestedMessage = this.readNestedMessage(payload.error);
    if (nestedMessage) {
      return nestedMessage;
    }
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
    return null;
  }

  private readNestedMessage(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
    if (Array.isArray(message)) {
      const joined = message
        .filter((entry): entry is string => typeof entry === 'string')
        .join(' ');
      return joined.trim() || null;
    }
    return null;
  }

  private clearWorkspaceNotice(): void {
    this.workspaceNoticeSignal.set(null);
  }

  private isClockSource(source: EmployeeHoursSource): boolean {
    return source === 'clock';
  }
}
