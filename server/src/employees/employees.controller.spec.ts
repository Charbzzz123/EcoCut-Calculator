import { Test } from '@nestjs/testing';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

describe('EmployeesController', () => {
  const listRoster = jest.fn();
  const listHoursEntries = jest.fn();
  const listJobHistoryEntries = jest.fn();
  const listStartNextJobReadiness = jest.fn();
  const createEmployeeProfile = jest.fn();
  const updateEmployeeProfile = jest.fn();
  const archiveEmployee = jest.fn();
  const createHoursEntry = jest.fn();
  const updateHoursEntry = jest.fn();
  const removeHoursEntry = jest.fn();

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
            createEmployeeProfile,
            updateEmployeeProfile,
            archiveEmployee,
            createHoursEntry,
            updateHoursEntry,
            removeHoursEntry,
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
    const controller = await createController();

    expect(controller.listRoster()).toEqual([{ id: 'emp-1' }]);
    expect(controller.listHoursEntries()).toEqual([{ id: 'hours-1' }]);
    expect(controller.listJobHistoryEntries()).toEqual([{ id: 'job-1' }]);
    expect(controller.listStartNextJobReadiness()).toEqual([
      { employeeId: 'emp-1' },
    ]);
  });

  it('parses manager role from headers for mutating endpoints', async () => {
    const controller = await createController();
    createEmployeeProfile.mockResolvedValue({ id: 'emp-new' });
    updateEmployeeProfile.mockResolvedValue({ id: 'emp-1' });
    archiveEmployee.mockResolvedValue({ id: 'emp-1', status: 'inactive' });
    createHoursEntry.mockResolvedValue({ id: 'hours-new' });
    updateHoursEntry.mockResolvedValue({ id: 'hours-1' });
    removeHoursEntry.mockResolvedValue(undefined);

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
    await controller.removeHoursEntry('hours-1', 'manager');

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
    expect(createHoursEntry).toHaveBeenCalledWith(
      expect.any(Object),
      'manager',
    );
    expect(updateHoursEntry).toHaveBeenCalledWith(
      'hours-1',
      { hours: 8 },
      'manager',
    );
    expect(removeHoursEntry).toHaveBeenCalledWith('hours-1', 'manager');
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
