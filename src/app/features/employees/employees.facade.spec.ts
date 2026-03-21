import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { EmployeesFacade } from './employees.facade.js';
import { EmployeesDataService } from './employees-data.service.js';
import type { EmployeeHoursRecord, EmployeeRosterRecord } from './employees.types.js';

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
      updatedByRole: 'owner',
      updatedAt: '2026-03-20T18:00:00Z',
    },
    {
      id: 'hours-active-2',
      employeeId: 'active-1',
      workDate: '2026-03-18',
      siteLabel: 'NDG',
      hours: 6.5,
      updatedByRole: 'manager',
      updatedAt: '2026-03-18T19:00:00Z',
    },
  ];

  async listEmployees(): Promise<EmployeeRosterRecord[]> {
    if (this.shouldFail) {
      throw new Error('boom');
    }
    return this.records;
  }

  async listHoursEntries(): Promise<EmployeeHoursRecord[]> {
    if (this.shouldFail) {
      throw new Error('boom');
    }
    return this.hoursRecords;
  }
}

describe('EmployeesFacade', () => {
  let facade: EmployeesFacade;
  let service: EmployeesDataServiceStub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EmployeesFacade, { provide: EmployeesDataService, useClass: EmployeesDataServiceStub }],
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

  it('blocks profile edit/archive in manager mode', async () => {
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
  });

  it('creates profiles and validates required/format constraints', async () => {
    await facade.loadRoster();
    facade.openCreateProfile();

    expect(facade.saveProfile()).toBe(false);
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
    expect(facade.saveProfile()).toBe(false);
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

    expect(facade.saveProfile()).toBe(true);
    expect(facade.profileEditorOpen()).toBe(false);
    expect(facade.rosterSnapshot().some((employee) => employee.fullName === 'Maya Sarkis')).toBe(
      true,
    );
  });

  it('updates profile in owner mode and blocks save in manager mode', async () => {
    await facade.loadRoster();
    facade.openEditProfile('active-1');
    facade.profileForm.controls.role.setValue('Operations lead');

    expect(facade.saveProfile()).toBe(true);
    expect(facade.rosterSnapshot().find((employee) => employee.id === 'active-1')?.role).toBe(
      'Operations lead',
    );

    facade.openEditProfile('active-1');
    facade.roleControl.setValue('manager');
    expect(facade.saveProfile()).toBe(false);
    expect(facade.profileErrorsSnapshot()[0]).toContain('cannot update existing profiles');
  });

  it('opens hours editor and validates new entries', async () => {
    await facade.loadRoster();
    facade.openHoursEditor('active-1');

    facade.hoursForm.setValue({ workDate: '', siteLabel: '', hours: '' });
    expect(facade.saveHoursEntry()).toBe(false);
    expect(facade.hoursErrorsSnapshot()[0]).toContain(
      'Required fields missing: Work date, Site / address, Hours.',
    );

    facade.hoursForm.setValue({ workDate: '2026-03-21', siteLabel: 'Laval', hours: '26' });
    expect(facade.saveHoursEntry()).toBe(false);
    expect(facade.hoursErrorsSnapshot()[0]).toContain('Hours must be a number greater than 0');

    facade.roleControl.setValue('manager');
    facade.hoursForm.setValue({ workDate: '2026-03-21', siteLabel: 'Laval', hours: '7.25' });
    expect(facade.saveHoursEntry()).toBe(true);
    expect(facade.selectedHoursEntriesSnapshot()[0]?.updatedByRole).toBe('manager');
  });

  it('supports editing and removing existing hours entries', async () => {
    await facade.loadRoster();
    facade.openHoursEditor('active-1');
    facade.editHoursEntry('hours-active-2');
    expect(facade.editingHoursEntry()?.siteLabel).toBe('NDG');

    facade.hoursForm.controls.siteLabel.setValue('NDG - Updated');
    facade.hoursForm.controls.hours.setValue('7');
    expect(facade.saveHoursEntry()).toBe(true);
    expect(
      facade.selectedHoursEntriesSnapshot().find((entry) => entry.id === 'hours-active-2')?.siteLabel,
    ).toBe('NDG - Updated');

    facade.removeHoursEntry('hours-active-2');
    expect(
      facade.selectedHoursEntriesSnapshot().some((entry) => entry.id === 'hours-active-2'),
    ).toBe(false);
    expect(facade.editingHoursEntry()).toBeNull();
    expect(facade.hoursForm.controls.siteLabel.value).toBe('');
    expect(facade.hoursForm.controls.hours.value).toBe('');

    facade.closeHoursEditor();
    expect(facade.hoursEditorOpen()).toBe(false);
  });

  it('blocks hours save when no employee is selected', async () => {
    await facade.loadRoster();
    facade.closeHoursEditor();
    expect(facade.saveHoursEntry()).toBe(false);
    expect(facade.hoursErrorsSnapshot()[0]).toContain('Select an employee before editing hours.');
  });

  it('exposes trackBy helpers and handles load errors', async () => {
    const roster = service.records[0]!;
    const hours = service.hoursRecords[0]!;
    expect(facade.trackByEmployeeId(0, roster)).toBe('active-1');
    expect(facade.trackByHoursEntryId(0, hours)).toBe('hours-active-1');

    service.shouldFail = true;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await facade.loadRoster();
    expect(facade.loadState()).toBe('error');
    expect(warnSpy).toHaveBeenCalledWith('Failed to load employee roster', expect.any(Error));
    warnSpy.mockRestore();
  });
});
