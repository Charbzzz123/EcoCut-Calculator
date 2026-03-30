import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { EmployeesFacade } from './employees.facade.js';
import { EmployeesDataService } from './employees-data.service.js';
import type {
  EmployeeHoursRecord,
  EmployeeLoggedJobOption,
  EmployeeJobHistoryRecord,
  EmployeeStartNextJobReadiness,
  EmployeeRosterRecord,
} from './employees.types.js';

class EmployeesDataServiceStub {
  shouldFail = false;
  readonly records: EmployeeRosterRecord[] = [
    {
      id: 'active-1',
      firstName: 'Alex',
      lastName: 'Nassif',
      fullName: 'Alex Nassif',
      phone: '(438) 111-1111',
      email: 'alex@ecocutqc.com',
      role: 'Crew lead',
      hourlyRate: 32,
      notes: 'Lead on large properties.',
      status: 'active',
      lastActivityAt: '2026-03-20T13:00:00Z',
    },
    {
      id: 'inactive-1',
      firstName: 'Nora',
      lastName: 'Bitar',
      fullName: 'Nora Bitar',
      phone: '(438) 222-2222',
      email: null,
      role: 'Crew support',
      hourlyRate: 24,
      notes: 'Seasonal crew.',
      status: 'inactive',
      lastActivityAt: null,
    },
  ];

  readonly hoursRecords: EmployeeHoursRecord[] = [
    {
      id: 'hours-active-1',
      employeeId: 'active-1',
      workDate: '2026-03-20',
      siteLabel: 'Westmount',
      hours: 8,
      source: 'manual',
      clockInAt: null,
      clockOutAt: null,
      updatedByRole: 'owner',
      updatedAt: '2026-03-20T18:00:00Z',
    },
    {
      id: 'hours-active-2',
      employeeId: 'active-1',
      workDate: '2026-03-18',
      siteLabel: 'NDG',
      hours: 6.5,
      source: 'manual',
      clockInAt: null,
      clockOutAt: null,
      updatedByRole: 'manager',
      updatedAt: '2026-03-18T19:00:00Z',
    },
  ];

  readonly jobHistoryRecords: EmployeeJobHistoryRecord[] = [
    {
      id: 'job-active-1',
      employeeId: 'active-1',
      siteLabel: 'Westmount Cedar Hedge',
      address: '1450 Pine Ave W',
      scheduledStart: '2026-03-20T13:00:00Z',
      scheduledEnd: '2026-03-20T17:00:00Z',
      hoursWorked: 8,
      status: 'completed',
    },
    {
      id: 'job-active-2',
      employeeId: 'active-1',
      siteLabel: 'NDG Maple Court',
      address: '2331 Sherbrooke St W',
      scheduledStart: '2099-03-24T12:00:00Z',
      scheduledEnd: '2099-03-24T15:00:00Z',
      hoursWorked: 3,
      status: 'scheduled',
    },
    {
      id: 'job-active-3',
      employeeId: 'active-1',
      siteLabel: 'NDG Upper Court',
      address: '2340 Sherbrooke St W',
      scheduledStart: '2099-03-24T14:00:00Z',
      scheduledEnd: '2099-03-24T16:00:00Z',
      hoursWorked: 2,
      status: 'scheduled',
    },
  ];

  readonly readinessRecords: EmployeeStartNextJobReadiness[] = [
    {
      employeeId: 'active-1',
      fullName: 'Alex Nassif',
      status: 'active',
      readinessState: 'available',
      scheduledJobsCount: 2,
      completedJobsCount: 1,
      scheduledHours: 5,
      completedHours: 8,
      nextScheduledStart: '2099-03-24T12:00:00Z',
      nextScheduledEnd: '2099-03-24T15:00:00Z',
      nextAvailableAt: '2099-03-24T16:00:00Z',
      lastCompletedAt: '2026-03-20T17:00:00Z',
      lastCompletedSite: 'Westmount Cedar Hedge',
      hasScheduleConflict: true,
      upcomingWindows: [
        {
          jobId: 'job-active-2',
          siteLabel: 'NDG Maple Court',
          address: '2331 Sherbrooke St W',
          startAt: '2099-03-24T12:00:00Z',
          endAt: '2099-03-24T15:00:00Z',
        },
      ],
    },
    {
      employeeId: 'inactive-1',
      fullName: 'Nora Bitar',
      status: 'inactive',
      readinessState: 'inactive',
      scheduledJobsCount: 0,
      completedJobsCount: 0,
      scheduledHours: 0,
      completedHours: 0,
      nextScheduledStart: null,
      nextScheduledEnd: null,
      nextAvailableAt: null,
      lastCompletedAt: null,
      lastCompletedSite: null,
      hasScheduleConflict: false,
      upcomingWindows: [],
    },
  ];

  readonly jobOptions: EmployeeLoggedJobOption[] = [
    {
      entryId: 'entry-westmount',
      clientName: 'Alex Nassif',
      siteLabel: 'Westmount Cedar Hedge',
      address: '1450 Pine Ave W',
      scheduledStart: '2026-03-20T13:00:00Z',
      scheduledEnd: '2026-03-20T17:00:00Z',
    },
    {
      entryId: 'entry-ndg',
      clientName: 'Nora Bitar',
      siteLabel: 'NDG Maple Court',
      address: '2331 Sherbrooke St W',
      scheduledStart: '2026-03-18T11:00:00Z',
      scheduledEnd: '2026-03-18T14:00:00Z',
    },
  ];

  async listEmployees(): Promise<EmployeeRosterRecord[]> {
    if (this.shouldFail) {
      throw new Error('boom');
    }
    return this.records.map((record) => ({ ...record }));
  }

  async listHoursEntries(): Promise<EmployeeHoursRecord[]> {
    if (this.shouldFail) {
      throw new Error('boom');
    }
    return this.hoursRecords.map((record) => ({ ...record }));
  }

  async listJobHistoryEntries(): Promise<EmployeeJobHistoryRecord[]> {
    if (this.shouldFail) {
      throw new Error('boom');
    }
    return this.jobHistoryRecords.map((record) => ({ ...record }));
  }

  async listStartNextJobReadiness() {
    if (this.shouldFail) {
      throw new Error('boom');
    }
    const now = Date.now();
    const activeNow = this.jobHistoryRecords.find(
      (entry) =>
        entry.employeeId === 'active-1' &&
        entry.status === 'scheduled' &&
        Date.parse(entry.scheduledStart) <= now &&
        Date.parse(entry.scheduledEnd) > now,
    );
    return this.readinessRecords.map((entry) =>
      entry.employeeId === 'active-1' && activeNow
        ? {
            ...entry,
            readinessState: 'scheduled',
            nextAvailableAt: activeNow.scheduledEnd,
          }
        : { ...entry },
    );
  }

  async listLoggedJobOptions(): Promise<EmployeeLoggedJobOption[]> {
    if (this.shouldFail) {
      throw new Error('boom');
    }
    return this.jobOptions.map((option) => ({ ...option }));
  }

  async updateScheduledHistoryEntry(
    entryId: string,
    payload: {
      siteLabel: string;
      address: string;
      scheduledStart: string;
      scheduledEnd: string;
    },
  ): Promise<EmployeeJobHistoryRecord> {
    const entry = this.jobHistoryRecords.find((record) => record.id === entryId);
    if (!entry) {
      throw new Error('missing');
    }
    Object.assign(entry, payload, {
      hoursWorked:
        Math.round(
          ((Date.parse(payload.scheduledEnd) - Date.parse(payload.scheduledStart)) / 3_600_000) *
            4,
        ) / 4,
    });
    return { ...entry };
  }

  async createEmployeeProfile(payload: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    role: string;
    hourlyRate: number;
    notes?: string;
  }) {
    const created = {
      id: 'new-employee',
      firstName: payload.firstName,
      lastName: payload.lastName,
      fullName: `${payload.firstName} ${payload.lastName}`,
      phone: payload.phone,
      email: payload.email ?? null,
      role: payload.role,
      hourlyRate: payload.hourlyRate,
      notes: payload.notes ?? '',
      status: 'active',
      lastActivityAt: null,
    } satisfies EmployeeRosterRecord;
    this.records.unshift(created);
    return created;
  }

  async updateEmployeeProfile(
    employeeId: string,
    payload: {
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
      role: string;
      hourlyRate: number;
      notes?: string;
    },
  ) {
    const current = this.records.find((entry) => entry.id === employeeId);
    if (!current) {
      throw new Error('missing');
    }
    Object.assign(current, {
      firstName: payload.firstName,
      lastName: payload.lastName,
      fullName: `${payload.firstName} ${payload.lastName}`,
      phone: payload.phone,
      email: payload.email ?? null,
      role: payload.role,
      hourlyRate: payload.hourlyRate,
      notes: payload.notes ?? '',
    });
    return current;
  }

  async archiveEmployee(employeeId: string) {
    const current = this.records.find((entry) => entry.id === employeeId);
    if (!current) {
      throw new Error('missing');
    }
    current.status = 'inactive';
    return current;
  }

  async restoreEmployee(employeeId: string) {
    const current = this.records.find((entry) => entry.id === employeeId);
    if (!current) {
      throw new Error('missing');
    }
    current.status = 'active';
    return current;
  }

  async createHoursEntry(payload: {
    employeeId: string;
    workDate: string;
    correctionNote?: string;
    jobEntryId?: string | null;
    hours: number;
  }) {
    const linkedJob = this.jobOptions.find((option) => option.entryId === payload.jobEntryId);
    const created = {
      id: 'hours-created',
      employeeId: payload.employeeId,
      workDate: payload.workDate,
      siteLabel: linkedJob?.siteLabel ?? 'Manual correction',
      hours: payload.hours,
      source: 'manual',
      jobEntryId: linkedJob?.entryId ?? null,
      correctionNote: linkedJob ? null : payload.correctionNote ?? null,
      clockInAt: null,
      clockOutAt: null,
      updatedByRole: 'manager',
      updatedAt: '2026-03-21T12:00:00Z',
    } satisfies EmployeeHoursRecord;
    this.hoursRecords.unshift(created);
    return created;
  }

  async updateHoursEntry(
    entryId: string,
    payload: {
      workDate: string;
      correctionNote?: string;
      jobEntryId?: string | null;
      hours: number;
    },
  ) {
    const current = this.hoursRecords.find((entry) => entry.id === entryId);
    if (!current) {
      throw new Error('missing');
    }
    const linkedJob = this.jobOptions.find((option) => option.entryId === payload.jobEntryId);
    Object.assign(current, payload, {
      siteLabel: linkedJob?.siteLabel ?? 'Manual correction',
      jobEntryId: linkedJob?.entryId ?? payload.jobEntryId ?? null,
      correctionNote: linkedJob ? null : payload.correctionNote ?? null,
      source: current.source,
      clockInAt: current.clockInAt,
      clockOutAt: current.clockOutAt,
      updatedByRole: 'manager',
      updatedAt: '2026-03-21T12:30:00Z',
    });
    return current;
  }

  async removeHoursEntry(entryId: string) {
    const index = this.hoursRecords.findIndex((entry) => entry.id === entryId);
    if (index >= 0) {
      this.hoursRecords.splice(index, 1);
    }
  }

  async recordClockAction(payload: { employeeId: string; action: 'clock_in' | 'clock_out' }) {
    const now = '2026-03-21T14:00:00Z';
    if (payload.action === 'clock_in') {
      const created = {
        id: `clock-${payload.employeeId}`,
        employeeId: payload.employeeId,
        workDate: '2026-03-21',
        siteLabel: 'Field shift',
        hours: 0,
        source: 'clock',
        clockInAt: now,
        clockOutAt: null,
        updatedByRole: 'manager',
        updatedAt: now,
      } satisfies EmployeeHoursRecord;
      this.hoursRecords.unshift(created);
      return created;
    }

    const openSession = this.hoursRecords.find(
      (entry) =>
        entry.employeeId === payload.employeeId && entry.source === 'clock' && !entry.clockOutAt,
    );
    if (!openSession) {
      throw new Error('No open session');
    }
    Object.assign(openSession, {
      hours: 2,
      clockOutAt: now,
      updatedAt: now,
    });
    return openSession;
  }
}

describe('EmployeesFacade', () => {
  let facade: EmployeesFacade;
  let service: EmployeesDataServiceStub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EmployeesFacade,
        { provide: EmployeesDataService, useClass: EmployeesDataServiceStub },
      ],
    });

    facade = TestBed.inject(EmployeesFacade);
    service = TestBed.inject(EmployeesDataService) as unknown as EmployeesDataServiceStub;
  });

  it('loads roster, hours, and computes stats', async () => {
    await facade.loadRoster();

    expect(facade.loadState()).toBe('ready');
    expect(facade.rosterSnapshot()).toHaveLength(2);
    expect(facade.statsSnapshot()).toEqual({ total: 2, active: 1, inactive: 1 });

    facade.openHoursEditor('active-1');
    expect(facade.selectedHoursEntriesSnapshot()).toHaveLength(2);
    expect(facade.selectedHoursTotals().totalHours).toBe('14.5');

    facade.openJobHistory('active-1');
    expect(facade.selectedEmployeeJobHistorySnapshot()).toHaveLength(3);
    expect(facade.selectedHistorySummary()).toEqual({
      jobsCount: 3,
      completedCount: 1,
      scheduledCount: 2,
      totalHours: '13',
      recentSite: 'NDG Upper Court',
    });

    const readiness = facade.startNextJobReadinessSnapshot();
    expect(readiness).toHaveLength(2);
    expect(readiness[0]?.employeeId).toBe('active-1');
    expect(readiness[0]?.hasScheduleConflict).toBe(true);
    expect(readiness[0]?.scheduledJobsCount).toBe(2);
    expect(readiness[0]?.nextScheduledStart).toBe('2099-03-24T12:00:00Z');
    expect(readiness[1]?.readinessState).toBe('inactive');
    expect(readiness[1]?.nextAvailableAt).toBeNull();
  });

  it('filters roster by status and query', async () => {
    await facade.loadRoster();
    facade.setStatusFilter('inactive');
    expect(facade.filteredRosterSnapshot()).toHaveLength(1);
    expect(facade.filteredRosterSnapshot()[0]?.id).toBe('inactive-1');

    facade.queryControl.setValue('alex');
    await new Promise((resolve) => setTimeout(resolve, 180));
    expect(facade.filteredRosterSnapshot()).toHaveLength(0);

    facade.setStatusFilter('all');
    facade.queryControl.setValue('2222');
    await new Promise((resolve) => setTimeout(resolve, 180));
    expect(facade.filteredRosterSnapshot().map((employee) => employee.id)).toEqual(['inactive-1']);
  });

  it('blocks profile edit/archive/restore in manager mode', async () => {
    await facade.loadRoster();

    facade.roleControl.setValue('manager');
    facade.openEditProfile('active-1');
    expect(facade.profileEditorOpen()).toBe(false);
    expect(facade.workspaceNotice()).toContain('Manager mode can add employees');

    facade.archiveEmployee('active-1');
    expect(facade.rosterSnapshot().find((employee) => employee.id === 'active-1')?.status).toBe(
      'active',
    );
    expect(facade.workspaceNotice()).toContain('cannot archive employees');

    facade.restoreEmployee('inactive-1');
    expect(facade.rosterSnapshot().find((employee) => employee.id === 'inactive-1')?.status).toBe(
      'inactive',
    );
    expect(facade.workspaceNotice()).toContain('cannot restore employees');
  });

  it('archives/restores an employee in owner mode and refreshes roster state', async () => {
    await facade.loadRoster();
    await facade.archiveEmployee('active-1');

    expect(facade.rosterSnapshot().find((employee) => employee.id === 'active-1')?.status).toBe(
      'inactive',
    );

    await facade.restoreEmployee('inactive-1');
    expect(facade.rosterSnapshot().find((employee) => employee.id === 'inactive-1')?.status).toBe(
      'active',
    );
    expect(facade.workspaceNotice()).toBeNull();
  });

  it('creates profiles and validates required/format constraints', async () => {
    await facade.loadRoster();
    facade.openCreateProfile();

    await expect(facade.saveProfile()).resolves.toBe(false);
    expect(facade.profileErrorsSnapshot()[0]).toContain(
      'Required fields missing: First name, Last name, Phone, Role, Hourly rate.',
    );

    facade.profileForm.setValue({
      firstName: 'Alex',
      lastName: 'Nassif',
      phone: '4381111111',
      email: 'bad',
      role: 'Crew lead',
      hourlyRate: '-1',
      notes: '',
    });
    await expect(facade.saveProfile()).resolves.toBe(false);
    expect(facade.profileErrorsSnapshot()).toContain('Phone must use format (###) ###-####.');
    expect(facade.profileErrorsSnapshot()).toContain('Email must be a valid address.');
    expect(facade.profileErrorsSnapshot()).toContain('Hourly rate must be greater than 0.');
    expect(facade.profileErrorsSnapshot().join(' ')).toContain('Duplicate employee detected');

    facade.profileForm.setValue({
      firstName: 'Maya',
      lastName: 'Sarkis',
      phone: '(438) 555-3131',
      email: 'maya@ecocutqc.com',
      role: 'Estimator',
      hourlyRate: '28.5',
      notes: 'Handles customer follow-ups.',
    });

    await expect(facade.saveProfile()).resolves.toBe(true);
    expect(facade.profileEditorOpen()).toBe(false);
    expect(facade.rosterSnapshot().some((employee) => employee.fullName === 'Maya Sarkis')).toBe(
      true,
    );

    facade.openCreateProfile();
    const createSpy = vi.spyOn(service, 'createEmployeeProfile');
    facade.profileForm.setValue({
      firstName: 'No',
      lastName: 'Email',
      phone: '(438) 555-9191',
      email: '   ',
      role: 'Crew support',
      hourlyRate: '24',
      notes: '   ',
    });
    await expect(facade.saveProfile()).resolves.toBe(true);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        email: undefined,
        notes: undefined,
      }),
      'owner',
    );
  });

  it('updates profile in owner mode and blocks save in manager mode', async () => {
    await facade.loadRoster();
    facade.openEditProfile('active-1');
    facade.profileForm.controls.role.setValue('Operations lead');

    await expect(facade.saveProfile()).resolves.toBe(true);
    expect(facade.rosterSnapshot().find((employee) => employee.id === 'active-1')?.role).toBe(
      'Operations lead',
    );

    facade.openEditProfile('active-1');
    facade.roleControl.setValue('manager');
    await expect(facade.saveProfile()).resolves.toBe(false);
    expect(facade.profileErrorsSnapshot()[0]).toContain('cannot update existing profiles');
  });

  it('opens hours editor and validates new entries', async () => {
    await facade.loadRoster();
    facade.openHoursEditor('active-1');
    expect(facade.hoursSuccessSnapshot()).toBeNull();

    facade.hoursForm.setValue({
      workDate: '',
      jobEntryId: '',
      correctionNote: '',
      hours: '',
    });
    await expect(facade.saveHoursEntry()).resolves.toBe(false);
    expect(facade.hoursErrorsSnapshot()[0]).toContain(
      'Required fields missing: Work date, Linked client job, Hours.',
    );

    facade.hoursForm.setValue({
      workDate: '2026-03-21',
      jobEntryId: '__manual__',
      correctionNote: '',
      hours: '26',
    });
    await expect(facade.saveHoursEntry()).resolves.toBe(false);
    expect(facade.hoursErrorsSnapshot()[0]).toContain('Hours must be a number greater than 0');

    facade.roleControl.setValue('manager');
    facade.hoursForm.setValue({
      workDate: '',
      jobEntryId: 'entry-westmount',
      correctionNote: '',
      hours: '7.25',
    });
    await expect(facade.saveHoursEntry()).resolves.toBe(true);
    expect(facade.hoursSuccessSnapshot()).toBe('Hours entry saved successfully.');
    expect(
      facade.selectedHoursEntriesSnapshot().find((entry) => entry.id === 'hours-created')
        ?.jobEntryId,
    ).toBe('entry-westmount');
    expect(
      facade.selectedHoursEntriesSnapshot().find((entry) => entry.id === 'hours-created')
        ?.updatedByRole,
    ).toBe('manager');
    expect(
      facade.selectedHoursEntriesSnapshot().find((entry) => entry.id === 'hours-created')
        ?.workDate,
    ).toBe('2026-03-20');

    // Runtime <input type="number"> can provide a numeric value.
    facade.hoursForm.controls.workDate.setValue('2026-03-22');
    facade.hoursForm.controls.jobEntryId.setValue('__manual__');
    facade.hoursForm.controls.correctionNote.setValue('Manual update');
    (facade.hoursForm.controls.hours as unknown as { setValue: (value: number) => void }).setValue(
      6.5,
    );
    await expect(facade.saveHoursEntry()).resolves.toBe(true);
  });

  it('supports editing and removing existing hours entries', async () => {
    await facade.loadRoster();
    facade.openHoursEditor('active-1');
    facade.editHoursEntry('hours-active-2');
    expect(facade.hoursSuccessSnapshot()).toBeNull();
    expect(facade.editingHoursEntry()?.siteLabel).toBe('NDG');

    facade.hoursForm.controls.jobEntryId.setValue('__manual__');
    facade.hoursForm.controls.correctionNote.setValue('Updated correction');
    facade.hoursForm.controls.hours.setValue('7');
    await expect(facade.saveHoursEntry()).resolves.toBe(true);
    expect(facade.hoursSuccessSnapshot()).toBe('Hours entry updated successfully.');
    expect(
      facade.selectedHoursEntriesSnapshot().find((entry) => entry.id === 'hours-active-2')
        ?.correctionNote,
    ).toBe('Updated correction');

    await facade.removeHoursEntry('hours-active-2');
    expect(facade.hoursSuccessSnapshot()).toBe('Hours entry removed.');
    expect(
      facade.selectedHoursEntriesSnapshot().some((entry) => entry.id === 'hours-active-2'),
    ).toBe(false);
    expect(facade.editingHoursEntry()).toBeNull();
    expect(facade.hoursForm.controls.correctionNote.value).toBe('');
    expect(facade.hoursForm.controls.hours.value).toBe('');

    facade.closeHoursEditor();
    expect(facade.hoursSuccessSnapshot()).toBeNull();
    expect(facade.hoursEditorOpen()).toBe(false);
  });

  it('reacts to linked-job selector changes for manual-note visibility state', async () => {
    await facade.loadRoster();
    facade.openHoursEditor('active-1');

    expect(facade.isManualHoursSelection()).toBe(true);
    expect(facade.selectedHoursJobOption()).toBeNull();

    facade.hoursForm.controls.jobEntryId.setValue('entry-westmount');
    expect(facade.isManualHoursSelection()).toBe(false);
    expect(facade.selectedHoursJobOption()?.entryId).toBe('entry-westmount');

    facade.hoursForm.controls.jobEntryId.setValue('__manual__');
    expect(facade.isManualHoursSelection()).toBe(true);
    expect(facade.selectedHoursJobOption()).toBeNull();
  });

  it('covers fallback branches for non-happy-path editor interactions', async () => {
    // Same-day entries should sort by latest update first.
    service.hoursRecords.push({
      id: 'hours-active-same-day',
      employeeId: 'active-1',
      workDate: '2026-03-20',
      siteLabel: 'Westmount - late update',
      hours: 1,
      source: 'manual',
      clockInAt: null,
      clockOutAt: null,
      updatedByRole: 'owner',
      updatedAt: '2026-03-20T19:00:00Z',
    });
    await facade.loadRoster();
    facade.openHoursEditor('active-1');
    expect(facade.selectedHoursEntriesSnapshot()[0]?.id).toBe('hours-active-same-day');
    facade.closeHoursEditor();

    // Branches where ids are missing / unresolved.
    facade.openEditProfile('missing-id');
    facade.openHoursEditor('missing-id');
    expect(facade.selectedHoursEmployee()).toBeNull();

    facade.openJobHistory('missing-id');
    expect(facade.selectedHistoryEmployee()).toBeNull();
    expect(facade.selectedEmployeeJobHistorySnapshot()).toEqual([]);

    facade.editHoursEntry('missing-entry');
    expect(facade.editingHoursEntry()).toBeNull();

    // Save in edit mode without an editing id to trigger validation branch.
    facade.openEditProfile('active-1');
    (
      facade as unknown as { editingEmployeeIdSignal: { set: (value: string | null) => void } }
    ).editingEmployeeIdSignal.set(null);
    facade.profileForm.patchValue({
      firstName: 'Unique',
      lastName: 'Operator',
      phone: '(438) 555-7777',
      email: 'unique@ecocutqc.com',
      role: 'Crew lead',
      hourlyRate: '30',
    });
    await expect(facade.saveProfile()).resolves.toBe(false);
    expect(facade.profileErrorsSnapshot()[0]).toContain(
      'Unable to resolve the employee profile being edited.',
    );

    // Remove while currently editing to clear form and editing state.
    facade.openHoursEditor('active-1');
    facade.editHoursEntry('hours-active-1');
    await facade.removeHoursEntry('hours-active-1');
    expect(facade.editingHoursEntry()).toBeNull();
    expect(facade.hoursForm.controls.correctionNote.value).toBe('');
    expect(facade.hoursForm.controls.hours.value).toBe('');

    // Error branch with nested string message.
    vi.spyOn(service, 'removeHoursEntry').mockRejectedValueOnce({
      error: { message: 'Cannot remove locked entry.' },
    });
    await facade.removeHoursEntry('hours-active-2');
    expect(facade.hoursErrorsSnapshot()[0]).toBe('Cannot remove locked entry.');

    // Active employee signal fallback when id has no match.
    facade.openEditProfile('active-1');
    (
      facade as unknown as { editingEmployeeIdSignal: { set: (value: string | null) => void } }
    ).editingEmployeeIdSignal.set('missing-id');
    expect(facade.activeEmployee()).toBeNull();
  });

  it('surfaces API error messages for hours mutations and falls back when missing', async () => {
    await facade.loadRoster();
    facade.openHoursEditor('active-1');
    facade.hoursForm.setValue({
      workDate: '2026-03-21',
      jobEntryId: '__manual__',
      correctionNote: '',
      hours: '7.25',
    });

    vi.spyOn(service, 'createHoursEntry').mockRejectedValueOnce({
      error: { message: ['Hours conflict.', 'Try another slot.'] },
    });
    await expect(facade.saveHoursEntry()).resolves.toBe(false);
    expect(facade.hoursSuccessSnapshot()).toBeNull();
    expect(facade.hoursErrorsSnapshot()[0]).toBe('Hours conflict. Try another slot.');

    vi.spyOn(service, 'createHoursEntry').mockRejectedValueOnce({ error: { message: 12 } });
    await expect(facade.saveHoursEntry()).resolves.toBe(false);
    expect(facade.hoursSuccessSnapshot()).toBeNull();
    expect(facade.hoursErrorsSnapshot()[0]).toBe('Unable to save hours entry.');

    vi.spyOn(service, 'createHoursEntry').mockRejectedValueOnce({
      error: { message: [1, 2] },
    });
    await expect(facade.saveHoursEntry()).resolves.toBe(false);
    expect(facade.hoursSuccessSnapshot()).toBeNull();
    expect(facade.hoursErrorsSnapshot()[0]).toBe('Unable to save hours entry.');
  });

  it('blocks hours save when no employee is selected', async () => {
    await facade.loadRoster();
    facade.closeHoursEditor();
    await expect(facade.saveHoursEntry()).resolves.toBe(false);
    expect(facade.hoursSuccessSnapshot()).toBeNull();
    expect(facade.hoursErrorsSnapshot()[0]).toContain('Select an employee before editing hours.');
  });

  it('exposes trackBy helpers and handles load errors', async () => {
    await facade.loadRoster();
    const roster = service.records[0]!;
    const hours = service.hoursRecords[0]!;
    const history = service.jobHistoryRecords[0]!;
    const readiness = facade.startNextJobReadinessSnapshot()[0];
    expect(facade.trackByEmployeeId(0, roster)).toBe('active-1');
    expect(facade.trackByHoursEntryId(0, hours)).toBe('hours-active-1');
    expect(facade.trackByHistoryEntryId(0, history)).toBe('job-active-1');
    expect(facade.trackByReadinessEmployeeId(0, readiness!)).toBe('active-1');

    service.shouldFail = true;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await facade.loadRoster();
    expect(facade.loadState()).toBe('error');
    expect(warnSpy).toHaveBeenCalledWith('Failed to load employee roster', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('opens and closes the history panel', async () => {
    await facade.loadRoster();
    expect(facade.activeEmployee()).toBeNull();
    facade.openJobHistory('active-1');
    expect(facade.historyPanelOpen()).toBe(true);
    expect(facade.selectedHistoryEmployee()?.id).toBe('active-1');

    facade.closeJobHistory();
    expect(facade.historyPanelOpen()).toBe(false);
    expect(facade.selectedHistoryEmployee()).toBeNull();
  });

  it('edits scheduled history entries and refreshes summary state', async () => {
    await facade.loadRoster();
    facade.openJobHistory('active-1');

    facade.startHistoryEdit('job-active-2');
    expect(facade.historyEditorOpen()).toBe(true);
    expect(facade.editingHistoryEntry()?.id).toBe('job-active-2');
    expect(facade.historyForm.controls.siteLabel.value).toBe('NDG Maple Court');

    facade.historyForm.setValue({
      siteLabel: 'NDG Maple Court Updated',
      address: '2390 Sherbrooke St W',
      scheduledStart: '2099-03-24T09:00',
      scheduledEnd: '2099-03-24T11:30',
    });

    await expect(facade.saveHistoryEdit()).resolves.toBe(true);
    expect(facade.historySuccessSnapshot()).toBe('History schedule updated successfully.');
    expect(facade.historyEditorOpen()).toBe(false);
    expect(
      facade
        .selectedEmployeeJobHistorySnapshot()
        .find((entry) => entry.id === 'job-active-2')?.siteLabel,
    ).toBe('NDG Maple Court Updated');

    facade.cancelHistoryEdit();
    expect(facade.historyEditorOpen()).toBe(false);
    expect(facade.historyErrorsSnapshot()).toEqual([]);
  });

  it('validates history edits and blocks cancelled entries', async () => {
    await facade.loadRoster();
    facade.openJobHistory('active-1');

    service.jobHistoryRecords.push({
      id: 'job-cancelled-1',
      employeeId: 'active-1',
      siteLabel: 'Cancelled route',
      address: '100 Test St',
      scheduledStart: '2099-03-28T12:00:00Z',
      scheduledEnd: '2099-03-28T14:00:00Z',
      hoursWorked: 2,
      status: 'cancelled',
    });
    await facade.loadRoster();
    facade.openJobHistory('active-1');

    facade.startHistoryEdit('job-cancelled-1');
    expect(facade.historyEditorOpen()).toBe(false);
    expect(facade.historyErrorsSnapshot()[0]).toContain('Cancelled history entries');

    facade.startHistoryEdit('job-active-2');
    facade.historyForm.setValue({
      siteLabel: '',
      address: '',
      scheduledStart: 'invalid',
      scheduledEnd: '2099-03-24T08:00',
    });
    await expect(facade.saveHistoryEdit()).resolves.toBe(false);
    expect(facade.historySuccessSnapshot()).toBeNull();
    expect(facade.historyErrorsSnapshot().join(' ')).toContain('Required fields missing');
    expect(facade.historyErrorsSnapshot().join(' ')).toContain('Scheduled start must be a valid');

    facade.historyForm.setValue({
      siteLabel: 'Westmount',
      address: '1450 Pine Ave W',
      scheduledStart: '2099-03-24T10:00',
      scheduledEnd: '2099-03-24T09:00',
    });
    await expect(facade.saveHistoryEdit()).resolves.toBe(false);
    expect(facade.historyErrorsSnapshot()[0]).toContain(
      'Scheduled end must be later than scheduled start.',
    );

    vi.spyOn(service, 'updateScheduledHistoryEntry').mockRejectedValueOnce({
      error: { message: 'Updated schedule overlaps "NDG Upper Court".' },
    });
    facade.historyForm.setValue({
      siteLabel: 'Westmount',
      address: '1450 Pine Ave W',
      scheduledStart: '2099-03-24T12:15',
      scheduledEnd: '2099-03-24T13:15',
    });
    await expect(facade.saveHistoryEdit()).resolves.toBe(false);
    expect(facade.historyErrorsSnapshot()[0]).toContain('Updated schedule overlaps');
  });

  it('surfaces nested and top-level API messages for profile/archive/restore failures', async () => {
    await facade.loadRoster();
    facade.openCreateProfile();
    facade.profileForm.setValue({
      firstName: 'Maya',
      lastName: 'Sarkis',
      phone: '(438) 555-3131',
      email: 'maya@ecocutqc.com',
      role: 'Estimator',
      hourlyRate: '28.5',
      notes: 'Handles customer follow-ups.',
    });

    vi.spyOn(service, 'createEmployeeProfile').mockRejectedValueOnce({
      error: 'ignored',
      message: 'Profile API unavailable.',
    });
    await expect(facade.saveProfile()).resolves.toBe(false);
    expect(facade.profileErrorsSnapshot()[0]).toBe('Profile API unavailable.');

    vi.spyOn(service, 'archiveEmployee').mockRejectedValueOnce('boom');
    await facade.archiveEmployee('active-1');
    expect(facade.workspaceNotice()).toBe('Unable to archive employee.');

    vi.spyOn(service, 'restoreEmployee').mockRejectedValueOnce('boom');
    await facade.restoreEmployee('inactive-1');
    expect(facade.workspaceNotice()).toBe('Unable to restore employee.');
  });

  it('marks employees as scheduled when an active booking overlaps now', async () => {
    const now = Date.now();
    const startedAt = new Date(now - 15 * 60 * 1000).toISOString();
    const endsAt = new Date(now + 45 * 60 * 1000).toISOString();
    service.jobHistoryRecords.push({
      id: 'job-active-now',
      employeeId: 'active-1',
      siteLabel: 'Live schedule',
      address: '123 Current Ave',
      scheduledStart: startedAt,
      scheduledEnd: endsAt,
      hoursWorked: 1,
      status: 'scheduled',
    });

    await facade.loadRoster();
    const readiness = facade
      .startNextJobReadinessSnapshot()
      .find((entry) => entry.employeeId === 'active-1');
    expect(readiness?.readinessState).toBe('scheduled');
    expect(readiness?.nextAvailableAt).toBe(endsAt);
  });

  it('builds clock summaries and supports clock in/out actions', async () => {
    await facade.loadRoster();

    const initial = facade
      .clockSummariesSnapshot()
      .find((entry) => entry.employeeId === 'active-1');
    expect(initial?.state).toBe('clocked_out');

    await expect(facade.clockIn('active-1')).resolves.toBe(true);
    const afterClockIn = facade
      .clockSummariesSnapshot()
      .find((entry) => entry.employeeId === 'active-1');
    expect(afterClockIn?.state).toBe('clocked_in');
    expect(afterClockIn?.clockInAt).toBeTruthy();

    await expect(facade.clockOut('active-1')).resolves.toBe(true);
    const afterClockOut = facade
      .clockSummariesSnapshot()
      .find((entry) => entry.employeeId === 'active-1');
    expect(afterClockOut?.state).toBe('clocked_out');
    expect(afterClockOut?.lastDurationHours).toBe('2');
  });

  it('surfaces API failures for clock actions', async () => {
    await facade.loadRoster();
    vi.spyOn(service, 'recordClockAction').mockRejectedValueOnce({
      error: { message: 'Already clocked in.' },
    });
    await expect(facade.clockIn('active-1')).resolves.toBe(false);
    expect(facade.workspaceNotice()).toBe('Already clocked in.');
  });
});
