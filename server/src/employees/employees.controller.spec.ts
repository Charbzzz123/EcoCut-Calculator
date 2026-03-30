import { Test } from '@nestjs/testing';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

describe('EmployeesController', () => {
  const listRoster = jest.fn();
  const listHoursEntries = jest.fn();
  const listJobHistoryEntries = jest.fn();
  const listStartNextJobReadiness = jest.fn();
  const listLoggedJobOptions = jest.fn();
  const getLifecycleReport = jest.fn();
  const createEmployeeProfile = jest.fn();
  const updateEmployeeProfile = jest.fn();
  const archiveEmployee = jest.fn();
  const restoreEmployee = jest.fn();
  const createHoursEntry = jest.fn();
  const recordClockAction = jest.fn();
  const updateHoursEntry = jest.fn();
  const removeHoursEntry = jest.fn();
  const createStartNextJobAssignment = jest.fn();
  const completeJobHistoryEntry = jest.fn();
  const updateScheduledHistoryEntry = jest.fn();
  const cancelScheduledHistoryEntry = jest.fn();
  const reassignScheduledHistoryEntry = jest.fn();
  const startAssignmentRun = jest.fn();
  const endAssignmentRun = jest.fn();
  const clockOutAssignmentMember = jest.fn();

  const createController = async (): Promise<EmployeesController> => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [
        {
          provide: EmployeesService,
          useValue: {
            listRoster,
            listHoursEntries,
            listJobHistoryEntries,
            listStartNextJobReadiness,
            listLoggedJobOptions,
            getLifecycleReport,
            createEmployeeProfile,
            updateEmployeeProfile,
            archiveEmployee,
            restoreEmployee,
            createHoursEntry,
            recordClockAction,
            updateHoursEntry,
            removeHoursEntry,
            createStartNextJobAssignment,
            completeJobHistoryEntry,
            updateScheduledHistoryEntry,
            cancelScheduledHistoryEntry,
            reassignScheduledHistoryEntry,
            startAssignmentRun,
            endAssignmentRun,
            clockOutAssignmentMember,
          },
        },
      ],
    }).compile();

    return moduleRef.get(EmployeesController);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards list endpoints', async () => {
    listRoster.mockReturnValue([{ id: 'emp-1' }]);
    listHoursEntries.mockReturnValue([{ id: 'hours-1' }]);
    listJobHistoryEntries.mockReturnValue([{ id: 'job-1' }]);
    listStartNextJobReadiness.mockReturnValue([{ employeeId: 'emp-1' }]);
    listLoggedJobOptions.mockReturnValue([{ entryId: 'entry-1' }]);
    getLifecycleReport.mockReturnValue({ generatedAt: '2026-03-30T00:00:00Z' });
    const controller = await createController();

    expect(controller.listRoster()).toEqual([{ id: 'emp-1' }]);
    expect(controller.listHoursEntries()).toEqual([{ id: 'hours-1' }]);
    expect(controller.listJobHistoryEntries()).toEqual([{ id: 'job-1' }]);
    expect(controller.listStartNextJobReadiness()).toEqual([
      { employeeId: 'emp-1' },
    ]);
    expect(controller.listLoggedJobOptions()).toEqual([{ entryId: 'entry-1' }]);
    expect(controller.getLifecycleReport()).toEqual({
      generatedAt: '2026-03-30T00:00:00Z',
    });
  });

  it('parses lifecycle report query params before forwarding to service', async () => {
    const controller = await createController();
    getLifecycleReport.mockReturnValue({ generatedAt: '2026-03-30T00:00:00Z' });

    controller.getLifecycleReport(
      '2026-03-01T00:00:00.000Z',
      '2026-03-30T23:59:59.000Z',
      'emp-1, emp-2, ,',
    );

    expect(getLifecycleReport).toHaveBeenCalledWith({
      from: '2026-03-01T00:00:00.000Z',
      to: '2026-03-30T23:59:59.000Z',
      employeeIds: ['emp-1', 'emp-2'],
    });
  });

  it('parses manager role from headers for mutating endpoints', async () => {
    const controller = await createController();
    createEmployeeProfile.mockResolvedValue({ id: 'emp-new' });
    updateEmployeeProfile.mockResolvedValue({ id: 'emp-1' });
    archiveEmployee.mockResolvedValue({ id: 'emp-1', status: 'inactive' });
    restoreEmployee.mockResolvedValue({ id: 'emp-1', status: 'active' });
    createHoursEntry.mockResolvedValue({ id: 'hours-new' });
    recordClockAction.mockResolvedValue({ id: 'clock-new' });
    updateHoursEntry.mockResolvedValue({ id: 'hours-1' });
    removeHoursEntry.mockResolvedValue(undefined);
    createStartNextJobAssignment.mockResolvedValue({
      assignmentId: 'assign-1',
    });
    completeJobHistoryEntry.mockResolvedValue({ id: 'job-1' });
    updateScheduledHistoryEntry.mockResolvedValue({ id: 'job-1' });
    cancelScheduledHistoryEntry.mockResolvedValue({ id: 'job-1' });
    reassignScheduledHistoryEntry.mockResolvedValue({ id: 'job-1' });
    startAssignmentRun.mockResolvedValue({ assignmentId: 'assign-1' });
    endAssignmentRun.mockResolvedValue({ assignmentId: 'assign-1' });
    clockOutAssignmentMember.mockResolvedValue({ assignmentId: 'assign-1' });

    await controller.createEmployeeProfile(
      {
        firstName: 'Lina',
        lastName: 'Sarkis',
        phone: '(438) 555-9000',
        role: 'Crew',
        hourlyRate: 28,
      },
      'manager',
    );
    await controller.updateEmployeeProfile(
      'emp-1',
      { notes: 'updated' },
      'manager',
    );
    await controller.archiveEmployee('emp-1', 'manager');
    await controller.restoreEmployee('emp-1', 'manager');
    await controller.createHoursEntry(
      {
        employeeId: 'emp-1',
        workDate: '2026-03-21',
        siteLabel: 'Laval',
        hours: 7,
      },
      'manager',
    );
    await controller.updateHoursEntry('hours-1', { hours: 8 }, 'manager');
    await controller.recordClockAction(
      {
        employeeId: 'emp-1',
        action: 'clock_in',
      },
      'manager',
    );
    await controller.removeHoursEntry('hours-1', 'manager');
    await controller.createStartNextJobAssignment(
      {
        jobLabel: 'Morning route',
        address: '1450 Pine Ave W',
        scheduledStart: '2026-03-24T12:00:00.000Z',
        scheduledEnd: '2026-03-24T15:00:00.000Z',
        employeeIds: ['emp-1'],
        jobEntryId: 'entry-1',
      },
      'manager',
    );
    await controller.completeJobHistoryEntry('job-1', 'manager');
    await controller.updateScheduledHistoryEntry(
      'job-1',
      {
        siteLabel: 'Morning route v2',
        address: '1452 Pine Ave W',
        scheduledStart: '2026-03-24T13:00:00.000Z',
        scheduledEnd: '2026-03-24T16:00:00.000Z',
      },
      'manager',
    );
    await controller.cancelScheduledHistoryEntry('job-1', 'manager');
    await controller.reassignScheduledHistoryEntry(
      'job-1',
      { employeeId: 'emp-2' },
      'manager',
    );
    await controller.startAssignmentRun('job-1', 'manager');
    await controller.endAssignmentRun('job-1', 'manager');
    await controller.clockOutAssignmentMember(
      'job-1',
      { reason: 'Left early' },
      'manager',
    );

    expect(createEmployeeProfile).toHaveBeenCalledWith(
      expect.any(Object),
      'manager',
    );
    expect(updateEmployeeProfile).toHaveBeenCalledWith(
      'emp-1',
      { notes: 'updated' },
      'manager',
    );
    expect(archiveEmployee).toHaveBeenCalledWith('emp-1', 'manager');
    expect(restoreEmployee).toHaveBeenCalledWith('emp-1', 'manager');
    expect(createHoursEntry).toHaveBeenCalledWith(
      expect.any(Object),
      'manager',
    );
    expect(updateHoursEntry).toHaveBeenCalledWith(
      'hours-1',
      { hours: 8 },
      'manager',
    );
    expect(recordClockAction).toHaveBeenCalledWith(
      {
        employeeId: 'emp-1',
        action: 'clock_in',
      },
      'manager',
    );
    expect(removeHoursEntry).toHaveBeenCalledWith('hours-1', 'manager');
    expect(createStartNextJobAssignment).toHaveBeenCalledWith(
      {
        jobLabel: 'Morning route',
        address: '1450 Pine Ave W',
        scheduledStart: '2026-03-24T12:00:00.000Z',
        scheduledEnd: '2026-03-24T15:00:00.000Z',
        employeeIds: ['emp-1'],
        jobEntryId: 'entry-1',
      },
      'manager',
    );
    expect(completeJobHistoryEntry).toHaveBeenCalledWith('job-1', 'manager');
    expect(updateScheduledHistoryEntry).toHaveBeenCalledWith(
      'job-1',
      {
        siteLabel: 'Morning route v2',
        address: '1452 Pine Ave W',
        scheduledStart: '2026-03-24T13:00:00.000Z',
        scheduledEnd: '2026-03-24T16:00:00.000Z',
      },
      'manager',
    );
    expect(cancelScheduledHistoryEntry).toHaveBeenCalledWith(
      'job-1',
      'manager',
    );
    expect(reassignScheduledHistoryEntry).toHaveBeenCalledWith(
      'job-1',
      { employeeId: 'emp-2' },
      'manager',
    );
    expect(startAssignmentRun).toHaveBeenCalledWith('job-1', 'manager');
    expect(endAssignmentRun).toHaveBeenCalledWith('job-1', 'manager');
    expect(clockOutAssignmentMember).toHaveBeenCalledWith(
      'job-1',
      { reason: 'Left early' },
      'manager',
    );
  });

  it('defaults unknown role headers to owner', async () => {
    const controller = await createController();
    createEmployeeProfile.mockResolvedValue({ id: 'emp-new' });

    await controller.createEmployeeProfile(
      {
        firstName: 'Lina',
        lastName: 'Sarkis',
        phone: '(438) 555-9000',
        role: 'Crew',
        hourlyRate: 28,
      },
      'unknown',
    );

    expect(createEmployeeProfile).toHaveBeenCalledWith(
      expect.any(Object),
      'owner',
    );
  });
});
