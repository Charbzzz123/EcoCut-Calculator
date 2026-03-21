import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { EmployeesRepository } from './employees.repository';
import { EmployeesService } from './employees.service';
import type { EmployeesSnapshot } from './employees.types';

class FakeEmployeesRepository {
  snapshot: EmployeesSnapshot = {
    roster: [
      {
        id: 'emp-owner',
        firstName: 'Alex',
        lastName: 'Nassif',
        fullName: 'Alex Nassif',
        phone: '(438) 111-1111',
        email: 'alex@ecocutqc.com',
        role: 'Crew lead',
        hourlyRate: 32,
        notes: '',
        status: 'active',
        lastActivityAt: null,
      },
      {
        id: 'emp-inactive',
        firstName: 'Nora',
        lastName: 'Bitar',
        fullName: 'Nora Bitar',
        phone: '(438) 222-2222',
        email: null,
        role: 'Support',
        hourlyRate: 24,
        notes: '',
        status: 'inactive',
        lastActivityAt: null,
      },
    ],
    hours: [
      {
        id: 'hours-1',
        employeeId: 'emp-owner',
        workDate: '2026-03-20',
        siteLabel: 'Westmount',
        hours: 8,
        source: 'manual',
        clockInAt: null,
        clockOutAt: null,
        updatedByRole: 'owner',
        updatedAt: '2026-03-20T18:00:00Z',
      },
    ],
    history: [
      {
        id: 'job-completed',
        employeeId: 'emp-owner',
        siteLabel: 'Westmount',
        address: '1450 Pine Ave W',
        scheduledStart: '2026-03-19T13:00:00Z',
        scheduledEnd: '2026-03-19T17:00:00Z',
        hoursWorked: 8,
        status: 'completed',
      },
      {
        id: 'job-future-1',
        employeeId: 'emp-owner',
        siteLabel: 'NDG-1',
        address: '2331 Sherbrooke St W',
        scheduledStart: '2099-03-24T12:00:00Z',
        scheduledEnd: '2099-03-24T15:00:00Z',
        hoursWorked: 3,
        status: 'scheduled',
      },
      {
        id: 'job-future-2',
        employeeId: 'emp-owner',
        siteLabel: 'NDG-2',
        address: '2340 Sherbrooke St W',
        scheduledStart: '2099-03-24T14:00:00Z',
        scheduledEnd: '2099-03-24T16:00:00Z',
        hoursWorked: 2,
        status: 'scheduled',
      },
    ],
  };

  loadSnapshot(): Promise<EmployeesSnapshot> {
    return Promise.resolve(
      JSON.parse(JSON.stringify(this.snapshot)) as EmployeesSnapshot,
    );
  }

  saveSnapshot(snapshot: EmployeesSnapshot): Promise<void> {
    this.snapshot = JSON.parse(JSON.stringify(snapshot)) as EmployeesSnapshot;
    return Promise.resolve();
  }
}

describe('EmployeesService', () => {
  let service: EmployeesService;
  let repository: FakeEmployeesRepository;

  beforeEach(async () => {
    repository = new FakeEmployeesRepository();
    service = new EmployeesService(
      repository as unknown as EmployeesRepository,
    );
    await service.onModuleInit();
  });

  it('returns roster/hours/history/readiness snapshots', () => {
    expect(service.listRoster()).toHaveLength(2);
    expect(service.listHoursEntries()).toHaveLength(1);
    expect(service.listJobHistoryEntries()).toHaveLength(3);

    const readiness = service.listStartNextJobReadiness();
    expect(readiness).toHaveLength(2);
    const active = readiness.find((entry) => entry.employeeId === 'emp-owner');
    expect(active?.hasScheduleConflict).toBe(true);
    expect(active?.scheduledJobsCount).toBe(2);
    expect(active?.readinessState).toBe('available');

    const inactive = readiness.find(
      (entry) => entry.employeeId === 'emp-inactive',
    );
    expect(inactive?.readinessState).toBe('inactive');
    expect(inactive?.nextAvailableAt).toBeNull();
  });

  it('allows manager to create profile and hours', async () => {
    const created = await service.createEmployeeProfile(
      {
        firstName: 'Lina',
        lastName: 'Sarkis',
        phone: '(438) 555-9000',
        email: 'lina@ecocutqc.com',
        role: 'Crew',
        hourlyRate: 29,
      },
      'manager',
    );
    expect(created.id).toContain('emp-lina-sarkis-');
    expect(service.listRoster().some((entry) => entry.id === created.id)).toBe(
      true,
    );

    const hours = await service.createHoursEntry(
      {
        employeeId: created.id,
        workDate: '2026-03-22',
        siteLabel: 'Outremont',
        hours: 7,
      },
      'manager',
    );
    expect(hours.updatedByRole).toBe('manager');
    expect(hours.source).toBe('manual');
    expect(
      service.listHoursEntries().some((entry) => entry.id === hours.id),
    ).toBe(true);
  });

  it('blocks manager from owner-only profile edits/archive', async () => {
    await expect(
      service.updateEmployeeProfile('emp-owner', { notes: 'x' }, 'manager'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.archiveEmployee('emp-owner', 'manager'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates and archives profiles for owner', async () => {
    const updated = await service.updateEmployeeProfile(
      'emp-owner',
      { role: 'Ops lead' },
      'owner',
    );
    expect(updated.role).toBe('Ops lead');

    const archived = await service.archiveEmployee('emp-owner', 'owner');
    expect(archived.status).toBe('inactive');
  });

  it('prevents duplicate employee creation', async () => {
    await expect(
      service.createEmployeeProfile(
        {
          firstName: 'Alex',
          lastName: 'Nassif',
          phone: '(438) 111-1111',
          email: 'alex@ecocutqc.com',
          role: 'Crew lead',
          hourlyRate: 33,
        },
        'owner',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates/removes hours entries and enforces entry lookup', async () => {
    const updated = await service.updateHoursEntry(
      'hours-1',
      { hours: 7.5, siteLabel: 'NDG' },
      'owner',
    );
    expect(updated.hours).toBe(7.5);
    expect(updated.siteLabel).toBe('NDG');

    await expect(
      service.updateHoursEntry('missing', { hours: 6 }, 'owner'),
    ).rejects.toBeInstanceOf(NotFoundException);

    await service.removeHoursEntry('hours-1', 'manager');
    expect(service.listHoursEntries()).toHaveLength(0);
  });

  it('records clock-in and clock-out sessions with audit metadata', async () => {
    const clockIn = await service.recordClockAction(
      {
        employeeId: 'emp-owner',
        action: 'clock_in',
        siteLabel: 'Morning shift',
      },
      'manager',
    );

    expect(clockIn.source).toBe('clock');
    expect(clockIn.siteLabel).toBe('Morning shift');
    expect(clockIn.clockInAt).toBeTruthy();
    expect(clockIn.clockOutAt).toBeNull();
    expect(clockIn.hours).toBe(0);

    const clockOut = await service.recordClockAction(
      {
        employeeId: 'emp-owner',
        action: 'clock_out',
      },
      'owner',
    );

    expect(clockOut.source).toBe('clock');
    expect(clockOut.clockOutAt).toBeTruthy();
    expect(clockOut.hours).toBeGreaterThan(0);
    expect(clockOut.updatedByRole).toBe('owner');
  });

  it('validates clock action edge cases', async () => {
    await expect(
      service.recordClockAction(
        {
          employeeId: 'emp-owner',
          action: 'clock_out',
        },
        'manager',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      service.recordClockAction(
        {
          employeeId: 'emp-inactive',
          action: 'clock_in',
        },
        'owner',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('persists start-next-job assignment into history and hours', async () => {
    const result = await service.createStartNextJobAssignment(
      {
        jobLabel: 'Morning route',
        address: '1450 Pine Ave W',
        scheduledStart: '2099-03-25T09:00:00.000Z',
        scheduledEnd: '2099-03-25T11:00:00.000Z',
        employeeIds: ['emp-owner'],
      },
      'manager',
    );

    expect(result.assignmentId).toContain('assign-');
    expect(result.createdHistory).toHaveLength(1);
    expect(result.createdHistory[0]?.status).toBe('scheduled');
    expect(result.createdHours).toHaveLength(1);
    expect(result.createdHours[0]?.source).toBe('assignment');
    expect(result.createdHours[0]?.updatedByRole).toBe('manager');

    const history = service.listJobHistoryEntries();
    const hours = service.listHoursEntries();
    expect(
      history.some((entry) => entry.id === result.createdHistory[0]?.id),
    ).toBe(true);
    expect(hours.some((entry) => entry.id === result.createdHours[0]?.id)).toBe(
      true,
    );
  });

  it('rejects conflicting or invalid start-next-job assignment payloads', async () => {
    await expect(
      service.createStartNextJobAssignment(
        {
          jobLabel: '',
          address: '',
          scheduledStart: '',
          scheduledEnd: '',
          employeeIds: [],
        },
        'owner',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.createStartNextJobAssignment(
        {
          jobLabel: 'Overlap route',
          address: '2331 Sherbrooke',
          scheduledStart: '2099-03-24T14:30:00.000Z',
          scheduledEnd: '2099-03-24T15:30:00.000Z',
          employeeIds: ['emp-owner'],
        },
        'owner',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      service.createStartNextJobAssignment(
        {
          jobLabel: 'Inactive route',
          address: '4100 Daniel-Johnson',
          scheduledStart: '2099-03-25T12:00:00.000Z',
          scheduledEnd: '2099-03-25T14:00:00.000Z',
          employeeIds: ['emp-inactive'],
        },
        'owner',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('marks scheduled history entries as completed and refreshes readiness totals', async () => {
    const completed = await service.completeJobHistoryEntry(
      'job-future-1',
      'manager',
    );

    expect(completed.status).toBe('completed');
    const updatedHistory = service
      .listJobHistoryEntries()
      .find((entry) => entry.id === 'job-future-1');
    expect(updatedHistory?.status).toBe('completed');

    const readiness = service
      .listStartNextJobReadiness()
      .find((entry) => entry.employeeId === 'emp-owner');
    expect(readiness?.scheduledJobsCount).toBe(1);
    expect(readiness?.completedJobsCount).toBe(2);
  });

  it('rejects complete action for missing or already completed history entries', async () => {
    await expect(
      service.completeJobHistoryEntry('missing-entry', 'owner'),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      service.completeJobHistoryEntry('job-completed', 'owner'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
