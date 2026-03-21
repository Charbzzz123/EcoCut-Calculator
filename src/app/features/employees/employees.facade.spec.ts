import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { EmployeesFacade } from './employees.facade.js';
import { EmployeesDataService } from './employees-data.service.js';
import type { EmployeeRosterRecord } from './employees.types.js';

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
      status: 'inactive',
      lastActivityAt: null,
    },
  ];

  async listEmployees(): Promise<EmployeeRosterRecord[]> {
    if (this.shouldFail) {
      throw new Error('boom');
    }
    return this.records;
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

  it('loads roster and computes stats', async () => {
    await facade.loadRoster();

    expect(facade.loadState()).toBe('ready');
    expect(facade.rosterSnapshot()).toHaveLength(2);
    expect(facade.statsSnapshot()).toEqual({ total: 2, active: 1, inactive: 1 });
  });

  it('filters roster by status', async () => {
    await facade.loadRoster();
    facade.setStatusFilter('inactive');

    expect(facade.filteredRosterSnapshot()).toHaveLength(1);
    expect(facade.filteredRosterSnapshot()[0]?.id).toBe('inactive-1');
  });

  it('filters roster by query and phone digits', async () => {
    await facade.loadRoster();

    facade.queryControl.setValue('alex');
    await new Promise((resolve) => setTimeout(resolve, 180));
    expect(facade.filteredRosterSnapshot().map((employee) => employee.id)).toEqual(['active-1']);

    facade.queryControl.setValue('2222');
    await new Promise((resolve) => setTimeout(resolve, 180));
    expect(facade.filteredRosterSnapshot().map((employee) => employee.id)).toEqual(['inactive-1']);
  });

  it('supports role/email filtering and short-digit misses', async () => {
    await facade.loadRoster();

    facade.queryControl.setValue('crew lead');
    await new Promise((resolve) => setTimeout(resolve, 180));
    expect(facade.filteredRosterSnapshot().map((employee) => employee.id)).toEqual(['active-1']);

    facade.queryControl.setValue('ecocutqc.com');
    await new Promise((resolve) => setTimeout(resolve, 180));
    expect(facade.filteredRosterSnapshot().map((employee) => employee.id)).toEqual(['active-1']);

    facade.queryControl.setValue('77');
    await new Promise((resolve) => setTimeout(resolve, 180));
    expect(facade.filteredRosterSnapshot()).toHaveLength(0);
  });

  it('exposes trackBy helper', () => {
    const record = service.records[0]!;
    expect(facade.trackByEmployeeId(0, record)).toBe('active-1');
  });

  it('returns empty results when status and query do not match', async () => {
    await facade.loadRoster();
    facade.setStatusFilter('inactive');
    facade.queryControl.setValue('alex');
    await new Promise((resolve) => setTimeout(resolve, 180));

    expect(facade.filteredRosterSnapshot()).toHaveLength(0);
  });

  it('sets error state when data load fails', async () => {
    service.shouldFail = true;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await facade.loadRoster();

    expect(facade.loadState()).toBe('error');
    expect(warnSpy).toHaveBeenCalledWith('Failed to load employee roster', expect.any(Error));
    warnSpy.mockRestore();
  });
});
