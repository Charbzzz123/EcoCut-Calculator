import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { debounceTime, distinctUntilChanged, startWith } from 'rxjs';
import { EmployeesDataService } from './employees-data.service.js';
import type {
  EmployeeAvailabilityWindow,
  EmployeeEditorMode,
  EmployeeHoursDraft,
  EmployeeHoursRecord,
  EmployeeJobHistoryRecord,
  EmployeeLoadState,
  EmployeeOperatorRole,
  EmployeeProfileDraft,
  EmployeeStartNextJobReadiness,
  EmployeeRosterRecord,
  EmployeeStatusFilter,
} from './employees.types.js';

const digitsOnly = (value: string): string => value.replace(/\D/g, '');
const normalizeText = (value: string): string => value.trim().toLowerCase();
const normalizeName = (firstName: string, lastName: string): string =>
  `${normalizeText(firstName)}|${normalizeText(lastName)}`;
const formatFullName = (firstName: string, lastName: string): string =>
  `${firstName.trim()} ${lastName.trim()}`.trim();
const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);
const formatHours = (hours: number): string =>
  Number.isInteger(hours) ? `${hours}` : hours.toFixed(2).replace(/\.?0+$/, '');
const sortHoursByDateDesc = (left: EmployeeHoursRecord, right: EmployeeHoursRecord): number => {
  if (left.workDate === right.workDate) {
    return right.updatedAt.localeCompare(left.updatedAt);
  }
  return right.workDate.localeCompare(left.workDate);
};
const sortHistoryByStartDesc = (
  left: EmployeeJobHistoryRecord,
  right: EmployeeJobHistoryRecord,
): number => right.scheduledStart.localeCompare(left.scheduledStart);
const toTimestamp = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};
const sortHistoryByStartAsc = (
  left: EmployeeJobHistoryRecord,
  right: EmployeeJobHistoryRecord,
): number => toTimestamp(left.scheduledStart) - toTimestamp(right.scheduledStart);
const formatIsoOrNull = (value: Date): string | null => {
  const timestamp = value.getTime();
  return Number.isNaN(timestamp) ? null : value.toISOString();
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\(\d{3}\)\s\d{3}-\d{4}$/;

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
    siteLabel: new FormControl('', { nonNullable: true }),
    hours: new FormControl('', { nonNullable: true }),
  });

  private readonly querySignal: WritableSignal<string> = signal('');
  private readonly statusFilterSignal: WritableSignal<EmployeeStatusFilter> =
    signal<EmployeeStatusFilter>('all');
  private readonly rosterSignal: WritableSignal<EmployeeRosterRecord[]> =
    signal<EmployeeRosterRecord[]>([]);
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
  private readonly hoursEntriesSignal: WritableSignal<EmployeeHoursRecord[]> =
    signal<EmployeeHoursRecord[]>([]);
  private readonly jobHistoryEntriesSignal: WritableSignal<EmployeeJobHistoryRecord[]> =
    signal<EmployeeJobHistoryRecord[]>([]);
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
  readonly profileEditorMode: Signal<EmployeeEditorMode> = this.profileEditorModeSignal.asReadonly();
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
  readonly selectedHoursTotals: Signal<{ totalHours: string; entryCount: number; lastUpdated: string }> =
    computed(() => {
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
    const entries = this.jobHistoryEntriesSignal().filter((entry) => entry.employeeId === selectedId);
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
  readonly startNextJobReadiness: Signal<EmployeeStartNextJobReadiness[]> = computed(() =>
    this.computeStartNextJobReadiness(this.rosterSignal(), this.jobHistoryEntriesSignal()),
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

  selectedEmployeeJobHistorySnapshot(): EmployeeJobHistoryRecord[] {
    return this.selectedEmployeeJobHistory();
  }

  startNextJobReadinessSnapshot(): EmployeeStartNextJobReadiness[] {
    return this.startNextJobReadiness();
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

  saveProfile(): boolean {
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

    const nextRecord = this.buildRecordFromDraft(draft);
    if (this.profileEditorModeSignal() === 'create') {
      this.rosterSignal.update((roster) => [nextRecord, ...roster]);
    } else {
      this.rosterSignal.update((roster) =>
        roster.map((employee) =>
          employee.id === nextRecord.id
            ? {
                ...employee,
                ...nextRecord,
                status: employee.status,
                lastActivityAt: employee.lastActivityAt,
              }
            : employee,
        ),
      );
    }

    this.cancelProfileEditor();
    return true;
  }

  archiveEmployee(employeeId: string): void {
    this.clearWorkspaceNotice();
    if (!this.canArchiveProfiles()) {
      this.workspaceNoticeSignal.set(
        'Manager mode cannot archive employees. Switch to Owner mode for archive actions.',
      );
      return;
    }

    this.rosterSignal.update((roster) =>
      roster.map((employee) =>
        employee.id === employeeId ? { ...employee, status: 'inactive' } : employee,
      ),
    );
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
    this.hoursForm.setValue({
      workDate: toIsoDate(new Date()),
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
  }

  editHoursEntry(entryId: string): void {
    this.clearWorkspaceNotice();
    const entry = this.selectedHoursEntries().find((record) => record.id === entryId);
    if (!entry) {
      return;
    }
    this.editingHoursEntryIdSignal.set(entry.id);
    this.hoursErrorsSignal.set([]);
    this.hoursForm.setValue({
      workDate: entry.workDate,
      siteLabel: entry.siteLabel,
      hours: formatHours(entry.hours),
    });
  }

  removeHoursEntry(entryId: string): void {
    this.clearWorkspaceNotice();
    this.hoursEntriesSignal.update((entries) => entries.filter((entry) => entry.id !== entryId));
    if (this.editingHoursEntryIdSignal() === entryId) {
      this.editingHoursEntryIdSignal.set(null);
      this.hoursForm.patchValue({ siteLabel: '', hours: '' });
    }
  }

  saveHoursEntry(): boolean {
    this.clearWorkspaceNotice();
    const selectedEmployee = this.selectedHoursEmployee();
    if (!selectedEmployee) {
      this.hoursErrorsSignal.set(['Select an employee before editing hours.']);
      return false;
    }

    const draft = this.readHoursDraftFromForm();
    const errors = this.validateHoursDraft(draft);
    if (errors.length) {
      this.hoursErrorsSignal.set(errors);
      return false;
    }

    const now = new Date().toISOString();
    const parsedHours = Number.parseFloat(draft.hours.trim());
    const editingId = this.editingHoursEntryIdSignal();
    if (editingId) {
      this.hoursEntriesSignal.update((entries) =>
        entries.map((entry) =>
          entry.id === editingId
            ? {
                ...entry,
                workDate: draft.workDate.trim(),
                siteLabel: draft.siteLabel.trim(),
                hours: parsedHours,
                updatedByRole: this.roleSignal(),
                updatedAt: now,
              }
            : entry,
        ),
      );
    } else {
      this.hoursEntriesSignal.update((entries) => [
        {
          id: this.createHoursId(selectedEmployee.id),
          employeeId: selectedEmployee.id,
          workDate: draft.workDate.trim(),
          siteLabel: draft.siteLabel.trim(),
          hours: parsedHours,
          updatedByRole: this.roleSignal(),
          updatedAt: now,
        },
        ...entries,
      ]);
    }

    this.editingHoursEntryIdSignal.set(null);
    this.hoursErrorsSignal.set([]);
    this.hoursForm.patchValue({ siteLabel: '', hours: '' });
    return true;
  }

  trackByEmployeeId = (_: number, employee: EmployeeRosterRecord): string => employee.id;

  trackByHoursEntryId = (_: number, entry: EmployeeHoursRecord): string => entry.id;

  trackByHistoryEntryId = (_: number, entry: EmployeeJobHistoryRecord): string => entry.id;

  trackByReadinessEmployeeId = (_: number, entry: EmployeeStartNextJobReadiness): string =>
    entry.employeeId;

  async loadRoster(): Promise<void> {
    this.loadStateSignal.set('loading');
    try {
      const [roster, hours, history] = await Promise.all([
        this.data.listEmployees(),
        this.data.listHoursEntries(),
        this.data.listJobHistoryEntries(),
      ]);
      this.rosterSignal.set(roster);
      this.hoursEntriesSignal.set(hours);
      this.jobHistoryEntriesSignal.set(history);
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

  private computeStartNextJobReadiness(
    roster: EmployeeRosterRecord[],
    historyEntries: EmployeeJobHistoryRecord[],
  ): EmployeeStartNextJobReadiness[] {
    const now = new Date();
    const nowTimestamp = now.getTime();
    const nowIso = now.toISOString();
    const readiness = roster.map((employee) =>
      this.buildReadinessRecord(employee, historyEntries, nowTimestamp, nowIso),
    );
    return readiness.sort((left, right) => left.fullName.localeCompare(right.fullName));
  }

  private buildReadinessRecord(
    employee: EmployeeRosterRecord,
    historyEntries: EmployeeJobHistoryRecord[],
    nowTimestamp: number,
    nowIso: string,
  ): EmployeeStartNextJobReadiness {
    const employeeHistory = historyEntries.filter((entry) => entry.employeeId === employee.id);
    const completedEntries = employeeHistory
      .filter((entry) => entry.status === 'completed')
      .sort(sortHistoryByStartDesc);
    const scheduledEntries = employeeHistory
      .filter((entry) => entry.status === 'scheduled')
      .sort(sortHistoryByStartAsc);
    const upcomingEntries = scheduledEntries.filter((entry) => toTimestamp(entry.scheduledEnd) > nowTimestamp);
    const activeEntries = upcomingEntries.filter((entry) => toTimestamp(entry.scheduledStart) <= nowTimestamp);
    const nextScheduledEntry = upcomingEntries[0] ?? null;

    const availabilityWindows = upcomingEntries.map((entry) => this.mapToAvailabilityWindow(entry));
    const nextAvailableAt =
      employee.status === 'inactive'
        ? null
        : this.computeNextAvailableAt(upcomingEntries, activeEntries, nowIso);
    const hasScheduleConflict = this.detectScheduleConflict(upcomingEntries);
    const readinessState =
      employee.status === 'inactive'
        ? 'inactive'
        : activeEntries.length
          ? 'scheduled'
          : 'available';

    return {
      employeeId: employee.id,
      fullName: employee.fullName,
      status: employee.status,
      readinessState,
      scheduledJobsCount: upcomingEntries.length,
      completedJobsCount: completedEntries.length,
      scheduledHours: upcomingEntries.reduce((sum, entry) => sum + entry.hoursWorked, 0),
      completedHours: completedEntries.reduce((sum, entry) => sum + entry.hoursWorked, 0),
      nextScheduledStart: nextScheduledEntry?.scheduledStart ?? null,
      nextScheduledEnd: nextScheduledEntry?.scheduledEnd ?? null,
      nextAvailableAt,
      lastCompletedAt: completedEntries[0]?.scheduledEnd ?? null,
      lastCompletedSite: completedEntries[0]?.siteLabel ?? null,
      hasScheduleConflict,
      upcomingWindows: availabilityWindows,
    };
  }

  private mapToAvailabilityWindow(entry: EmployeeJobHistoryRecord): EmployeeAvailabilityWindow {
    return {
      jobId: entry.id,
      siteLabel: entry.siteLabel,
      address: entry.address,
      startAt: entry.scheduledStart,
      endAt: entry.scheduledEnd,
    };
  }

  private computeNextAvailableAt(
    upcomingEntries: EmployeeJobHistoryRecord[],
    activeEntries: EmployeeJobHistoryRecord[],
    nowIso: string,
  ): string | null {
    if (!upcomingEntries.length) {
      return nowIso;
    }
    if (!activeEntries.length) {
      return nowIso;
    }

    let availabilityTimestamp = Math.max(...activeEntries.map((entry) => toTimestamp(entry.scheduledEnd)));
    for (const entry of upcomingEntries) {
      const start = toTimestamp(entry.scheduledStart);
      if (start > availabilityTimestamp) {
        break;
      }
      availabilityTimestamp = Math.max(availabilityTimestamp, toTimestamp(entry.scheduledEnd));
    }
    return formatIsoOrNull(new Date(availabilityTimestamp));
  }

  private detectScheduleConflict(upcomingEntries: EmployeeJobHistoryRecord[]): boolean {
    if (upcomingEntries.length <= 1) {
      return false;
    }

    for (let index = 1; index < upcomingEntries.length; index += 1) {
      const previous = upcomingEntries[index - 1];
      const current = upcomingEntries[index];
      if (!previous || !current) {
        continue;
      }
      if (toTimestamp(current.scheduledStart) < toTimestamp(previous.scheduledEnd)) {
        return true;
      }
    }
    return false;
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

  private buildRecordFromDraft(draft: EmployeeProfileDraft): EmployeeRosterRecord {
    const editingId = this.editingEmployeeIdSignal();
    const parsedRate = Number.parseFloat(draft.hourlyRate.trim());
    const existing = editingId
      ? this.rosterSignal().find((employee) => employee.id === editingId) ?? null
      : null;
    return {
      id: editingId ?? this.createEmployeeId(draft),
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      fullName: formatFullName(draft.firstName, draft.lastName),
      phone: draft.phone.trim(),
      email: draft.email.trim() ? draft.email.trim() : null,
      role: draft.role.trim(),
      hourlyRate: Number.isFinite(parsedRate) ? parsedRate : 0,
      notes: draft.notes.trim(),
      status: existing?.status ?? 'active',
      lastActivityAt: existing?.lastActivityAt ?? null,
    };
  }

  private createEmployeeId(draft: EmployeeProfileDraft): string {
    const slug =
      `${draft.firstName.trim()}-${draft.lastName.trim()}`.toLowerCase().replace(/\s+/g, '-');
    return `emp-${slug}-${Date.now()}`;
  }

  private readHoursDraftFromForm(): EmployeeHoursDraft {
    return {
      workDate: this.hoursForm.controls.workDate.value,
      siteLabel: this.hoursForm.controls.siteLabel.value,
      hours: this.hoursForm.controls.hours.value,
    };
  }

  private validateHoursDraft(draft: EmployeeHoursDraft): string[] {
    const errors: string[] = [];
    const missingLabels: string[] = [];
    if (!draft.workDate.trim()) {
      missingLabels.push('Work date');
    }
    if (!draft.siteLabel.trim()) {
      missingLabels.push('Site / address');
    }
    if (!draft.hours.trim()) {
      missingLabels.push('Hours');
    }
    if (missingLabels.length) {
      errors.push(`Required fields missing: ${missingLabels.join(', ')}.`);
    }

    const parsedHours = Number.parseFloat(draft.hours.trim());
    if (draft.hours.trim() && (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 24)) {
      errors.push('Hours must be a number greater than 0 and less than or equal to 24.');
    }

    return errors;
  }

  private createHoursId(employeeId: string): string {
    return `hours-${employeeId}-${Date.now()}`;
  }

  private clearWorkspaceNotice(): void {
    this.workspaceNoticeSignal.set(null);
  }
}
