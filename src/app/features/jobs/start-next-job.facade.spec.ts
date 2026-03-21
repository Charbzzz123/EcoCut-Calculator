import { TestBed } from '@angular/core/testing';
import { StartNextJobFacade } from './start-next-job.facade.js';
import { EmployeesDataService } from '../employees/employees-data.service.js';
import type {
  EmployeeJobHistoryRecord,
  EmployeeStartNextJobReadiness,
} from '../employees/employees.types.js';

class EmployeesDataServiceStub {
  readiness: EmployeeStartNextJobReadiness[] = [];
  history: EmployeeJobHistoryRecord[] = [];
  shouldFail = false;
  shouldFailCreate = false;
  shouldFailComplete = false;
  shouldFailUpdate = false;
  shouldFailCancel = false;
  shouldFailReassign = false;
  shouldFailCompleteIds = new Set<string>();
  shouldFailCancelIds = new Set<string>();
  completeCalls: string[] = [];
  updateCalls: string[] = [];
  cancelCalls: string[] = [];
  reassignCalls: { entryId: string; employeeId: string }[] = [];

  async listStartNextJobReadiness(): Promise<EmployeeStartNextJobReadiness[]> {
    if (this.shouldFail) {
      throw new Error('failure');
    }
    return this.readiness;
  }

  async listJobHistoryEntries(): Promise<EmployeeJobHistoryRecord[]> {
    if (this.shouldFail) {
      throw new Error('failure');
    }
    return this.history;
  }

  async createStartNextJobAssignment() {
    if (this.shouldFailCreate) {
      throw new Error('save-failure');
    }
    return {
      assignmentId: 'assign-1',
      createdHistory: [
        {
          id: 'created-history-1',
          employeeId: 'emp-a',
          siteLabel: 'Morning trim',
          address: '12 Crew St',
          scheduledStart: '2026-03-21T09:00:00.000Z',
          scheduledEnd: '2026-03-21T10:00:00.000Z',
          hoursWorked: 1,
          status: 'scheduled' as const,
        },
      ],
      createdHours: [],
    };
  }

  async completeJobHistoryEntry(entryId: string) {
    this.completeCalls.push(entryId);
    if (this.shouldFailComplete || this.shouldFailCompleteIds.has(entryId)) {
      throw new Error('complete-failure');
    }
    return {
      id: entryId,
      employeeId: 'emp-b',
      siteLabel: 'Downtown',
      address: '2 Main St',
      scheduledStart: '2026-03-21T14:00:00.000Z',
      scheduledEnd: '2026-03-21T17:00:00.000Z',
      hoursWorked: 3,
      status: 'completed' as const,
    };
  }

  async updateScheduledHistoryEntry(
    entryId: string,
    payload: {
      siteLabel: string;
      address: string;
      scheduledStart: string;
      scheduledEnd: string;
    },
  ) {
    this.updateCalls.push(entryId);
    if (this.shouldFailUpdate) {
      throw new Error('update-failure');
    }
    return {
      id: entryId,
      employeeId: 'emp-b',
      siteLabel: payload.siteLabel,
      address: payload.address,
      scheduledStart: payload.scheduledStart,
      scheduledEnd: payload.scheduledEnd,
      hoursWorked: 2,
      status: 'scheduled' as const,
    };
  }

  async cancelScheduledHistoryEntry(entryId: string) {
    this.cancelCalls.push(entryId);
    if (this.shouldFailCancel || this.shouldFailCancelIds.has(entryId)) {
      throw new Error('cancel-failure');
    }
    return {
      id: entryId,
      employeeId: 'emp-b',
      siteLabel: 'Downtown',
      address: '2 Main St',
      scheduledStart: '2026-03-21T14:00:00.000Z',
      scheduledEnd: '2026-03-21T17:00:00.000Z',
      hoursWorked: 3,
      status: 'cancelled' as const,
    };
  }

  async reassignScheduledHistoryEntry(
    entryId: string,
    payload: { employeeId: string },
  ) {
    this.reassignCalls.push({ entryId, employeeId: payload.employeeId });
    if (this.shouldFailReassign) {
      throw new Error('reassign-failure');
    }
    return {
      id: entryId,
      employeeId: payload.employeeId,
      siteLabel: 'Downtown',
      address: '2 Main St',
      scheduledStart: '2026-03-21T14:00:00.000Z',
      scheduledEnd: '2026-03-21T17:00:00.000Z',
      hoursWorked: 3,
      status: 'scheduled' as const,
    };
  }
}

const mockReadiness: EmployeeStartNextJobReadiness[] = [
  {
    employeeId: 'emp-a',
    fullName: 'Alex North',
    status: 'active',
    readinessState: 'available',
    scheduledJobsCount: 0,
    completedJobsCount: 4,
    scheduledHours: 0,
    completedHours: 26,
    nextScheduledStart: null,
    nextScheduledEnd: null,
    nextAvailableAt: '2026-03-21T12:00:00.000Z',
    lastCompletedAt: '2026-03-20T16:00:00.000Z',
    lastCompletedSite: 'Westmount',
    hasScheduleConflict: false,
    upcomingWindows: [],
  },
  {
    employeeId: 'emp-b',
    fullName: 'Bruno East',
    status: 'active',
    readinessState: 'scheduled',
    scheduledJobsCount: 1,
    completedJobsCount: 1,
    scheduledHours: 3,
    completedHours: 6,
    nextScheduledStart: '2026-03-21T14:00:00.000Z',
    nextScheduledEnd: '2026-03-21T17:00:00.000Z',
    nextAvailableAt: '2026-03-21T17:00:00.000Z',
    lastCompletedAt: '2026-03-20T15:00:00.000Z',
    lastCompletedSite: 'Downtown',
    hasScheduleConflict: true,
    upcomingWindows: [
      {
        jobId: 'job-1',
        siteLabel: 'Downtown',
        address: '1 Main St',
        startAt: '2026-03-21T14:00:00.000Z',
        endAt: '2026-03-21T17:00:00.000Z',
      },
    ],
  },
  {
    employeeId: 'emp-c',
    fullName: 'Carmen South',
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

const mockHistory: EmployeeJobHistoryRecord[] = [
  {
    id: 'hist-1',
    employeeId: 'emp-a',
    siteLabel: 'Westmount',
    address: '1 Main St',
    scheduledStart: '2026-03-20T13:00:00.000Z',
    scheduledEnd: '2026-03-20T15:00:00.000Z',
    hoursWorked: 2,
    status: 'completed',
  },
  {
    id: 'hist-2',
    employeeId: 'emp-b',
    siteLabel: 'Downtown',
    address: '2 Main St',
    scheduledStart: '2026-03-21T14:00:00.000Z',
    scheduledEnd: '2026-03-21T17:00:00.000Z',
    hoursWorked: 3,
    status: 'scheduled',
  },
];

describe('StartNextJobFacade', () => {
  let facade: StartNextJobFacade;
  let dataService: EmployeesDataServiceStub;

  beforeEach(() => {
    dataService = new EmployeesDataServiceStub();
    dataService.readiness = mockReadiness;
    dataService.history = mockHistory;

    TestBed.configureTestingModule({
      providers: [StartNextJobFacade, { provide: EmployeesDataService, useValue: dataService }],
    });

    facade = TestBed.inject(StartNextJobFacade);
  });

  it('loads readiness/history and sorts readiness list', async () => {
    await facade.loadBoard();

    expect(facade.loadState()).toBe('ready');
    expect(facade.readinessSnapshot().map((employee) => employee.fullName)).toEqual([
      'Alex North',
      'Bruno East',
      'Carmen South',
    ]);
  });

  it('filters readiness by query and toggles selected crew', async () => {
    await facade.loadBoard();
    facade.queryControl.setValue('bruno');
    expect(facade.filteredReadiness().map((employee) => employee.employeeId)).toEqual(['emp-b']);

    facade.toggleEmployeeSelection('emp-b');
    expect(facade.isEmployeeSelected('emp-b')).toBe(true);
    facade.toggleEmployeeSelection('emp-b');
    expect(facade.isEmployeeSelected('emp-b')).toBe(false);
  });

  it('computes blocking reasons when draft is incomplete', async () => {
    await facade.loadBoard();
    const validation = facade.draftValidation();
    expect(validation.isReady).toBe(false);
    expect(validation.blockingReasons).toContain('Job label is required.');
    expect(validation.blockingReasons).toContain('Select at least one employee for the crew.');
  });

  it('surfaces crew conflicts and history items for selected employees', async () => {
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-b');
    facade.jobLabelControl.setValue('Trim route');
    facade.addressControl.setValue('55 Route');
    facade.scheduledStartControl.setValue('2026-03-21T14:30');
    facade.scheduledEndControl.setValue('2026-03-21T15:30');

    expect(facade.selectedCrewConflicts().length).toBeGreaterThan(0);
    expect(facade.selectedCrewHistory().map((item) => item.employeeName)).toEqual(['Bruno East']);
  });

  it('marks draft ready when required fields are valid and no conflicts remain', async () => {
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-a');
    facade.jobLabelControl.setValue('Morning trim');
    facade.addressControl.setValue('12 Crew St');
    facade.scheduledStartControl.setValue('2026-03-21T09:00');
    facade.scheduledEndControl.setValue('2026-03-21T10:00');

    expect(facade.selectedCrewConflicts()).toEqual([]);
    expect(facade.draftValidation().isReady).toBe(true);
  });

  it('reports API failure state cleanly', async () => {
    dataService.shouldFail = true;
    await facade.loadBoard();
    expect(facade.loadState()).toBe('error');
    expect(facade.errorMessage()).toBe('Unable to load Start Next Job data right now.');
  });

  it('exposes helper methods for pills and tracking', async () => {
    await facade.loadBoard();
    const availableEmployee = facade.readinessSnapshot()[0];
    const scheduledEmployee = facade.readinessSnapshot()[1];
    const inactiveEmployee = facade.readinessSnapshot()[2];
    const conflict = { employeeId: 'emp-a', employeeName: 'Alex', reason: 'x' };
    const historyItem = {
      ...mockHistory[0],
      employeeName: 'Alex North',
    };

    expect(facade.getReadinessPill(availableEmployee)).toEqual({
      text: 'Available',
      state: 'available',
    });
    expect(facade.getReadinessPill(scheduledEmployee)).toEqual({
      text: 'Scheduled',
      state: 'scheduled',
    });
    expect(facade.getReadinessPill(inactiveEmployee)).toEqual({
      text: 'Inactive',
      state: 'inactive',
    });
    expect(facade.trackByEmployeeId(0, availableEmployee)).toBe(availableEmployee.employeeId);
    expect(facade.trackByCrewConflict(0, conflict)).toContain('emp-a');
    expect(facade.trackByHistoryEntry(0, historyItem)).toBe(historyItem.id);
  });

  it('clearCrewSelection empties selected ids', async () => {
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-a');
    facade.toggleEmployeeSelection('emp-b');
    expect(facade.selectedEmployeeIds()).toEqual(['emp-a', 'emp-b']);
    facade.clearCrewSelection();
    expect(facade.selectedEmployeeIds()).toEqual([]);
  });

  it('tracks scheduled history selection independently from crew selection', async () => {
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-b');
    expect(facade.selectedCrewHistory().map((entry) => entry.id)).toEqual(['hist-2']);
    expect(facade.scheduledHistoryCount()).toBe(1);
    expect(facade.selectedScheduledHistoryCount()).toBe(0);

    facade.toggleHistoryEntrySelection('hist-2');
    expect(facade.isHistoryEntrySelected('hist-2')).toBe(true);
    expect(facade.selectedScheduledHistoryCount()).toBe(1);

    facade.clearHistorySelection();
    expect(facade.selectedScheduledHistoryCount()).toBe(0);
  });

  it('computes assignment analytics from selected crew history', async () => {
    dataService.history = [
      {
        id: 'hist-10',
        employeeId: 'emp-b',
        siteLabel: 'Downtown',
        address: '2 Main St',
        scheduledStart: '2026-03-21T14:00:00.000Z',
        scheduledEnd: '2026-03-21T16:00:00.000Z',
        hoursWorked: 2,
        status: 'scheduled',
      },
      {
        id: 'hist-11',
        employeeId: 'emp-b',
        siteLabel: 'Downtown',
        address: '2 Main St',
        scheduledStart: '2026-03-20T14:00:00.000Z',
        scheduledEnd: '2026-03-20T17:00:00.000Z',
        hoursWorked: 3,
        status: 'completed',
      },
      {
        id: 'hist-12',
        employeeId: 'emp-b',
        siteLabel: 'Outremont',
        address: '9 Side St',
        scheduledStart: '2026-03-19T09:00:00.000Z',
        scheduledEnd: '2026-03-19T11:00:00.000Z',
        hoursWorked: 2,
        status: 'cancelled',
      },
    ];
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-b');

    expect(facade.assignmentAnalytics()).toEqual({
      totalTracked: 3,
      scheduledCount: 1,
      completedCount: 1,
      cancelledCount: 1,
      totalHours: 7,
      averageHours: 2.33,
      completionRate: 33.3,
      cancellationRate: 33.3,
      uniqueSites: 2,
    });
  });

  it('trims selected ids when refreshed readiness no longer contains them', async () => {
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-b');
    expect(facade.selectedEmployeeIds()).toEqual(['emp-b']);

    dataService.readiness = [mockReadiness[0]];
    await facade.loadBoard();

    expect(facade.selectedEmployeeIds()).toEqual([]);
    expect(facade.readinessSnapshot().map((entry) => entry.employeeId)).toEqual(['emp-a']);
  });

  it('flags inactive crew member conflicts without needing draft times', async () => {
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-c');
    expect(facade.selectedCrewConflicts()).toEqual([
      {
        employeeId: 'emp-c',
        employeeName: 'Carmen South',
        reason: 'Employee is inactive.',
      },
    ]);
  });

  it('adds end-before-start validation message when times are inverted', async () => {
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-a');
    facade.jobLabelControl.setValue('Late route');
    facade.addressControl.setValue('44 Main');
    facade.scheduledStartControl.setValue('2026-03-21T12:00');
    facade.scheduledEndControl.setValue('2026-03-21T11:00');

    expect(facade.draftValidation().blockingReasons).toContain(
      'Scheduled end must be after scheduled start.',
    );
  });

  it('submits assignment, resets draft, and keeps save success feedback', async () => {
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-a');
    facade.jobLabelControl.setValue('Morning trim');
    facade.addressControl.setValue('12 Crew St');
    facade.scheduledStartControl.setValue('2026-03-21T09:00');
    facade.scheduledEndControl.setValue('2026-03-21T10:00');

    await expect(facade.submitAssignment('manager')).resolves.toBe(true);
    expect(facade.saveState()).toBe('success');
    expect(facade.saveMessage()).toContain('Assignment saved for 1 crew member');
    expect(facade.selectedEmployeeIds()).toEqual([]);
    expect(facade.jobLabelControl.value).toBe('');
    expect(facade.addressControl.value).toBe('');
  });

  it('returns save error feedback when assignment mutation fails', async () => {
    await facade.loadBoard();
    dataService.shouldFailCreate = true;
    facade.toggleEmployeeSelection('emp-a');
    facade.jobLabelControl.setValue('Morning trim');
    facade.addressControl.setValue('12 Crew St');
    facade.scheduledStartControl.setValue('2026-03-21T09:00');
    facade.scheduledEndControl.setValue('2026-03-21T10:00');

    await expect(facade.submitAssignment()).resolves.toBe(false);
    expect(facade.saveState()).toBe('error');
    expect(facade.saveMessage()).toBe('Unable to save assignment right now.');
  });

  it('marks scheduled history entries as completed and refreshes board', async () => {
    await facade.loadBoard();

    await expect(facade.completeHistoryEntry('hist-2', 'manager')).resolves.toBe(true);
    expect(dataService.completeCalls).toEqual(['hist-2']);
    expect(facade.saveState()).toBe('success');
    expect(facade.saveMessage()).toBe('Assignment marked as completed.');
  });

  it('surfaces complete-action API failures', async () => {
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-b');
    dataService.shouldFailComplete = true;

    const completionPromise = facade.completeHistoryEntry('hist-2');
    expect(facade.selectedCrewHistory().find((entry) => entry.id === 'hist-2')?.status).toBe(
      'completed',
    );
    await expect(completionPromise).resolves.toBe(false);
    expect(facade.saveState()).toBe('error');
    expect(facade.saveMessage()).toBe('Unable to mark assignment as completed right now.');
    expect(facade.selectedCrewHistory().find((entry) => entry.id === 'hist-2')?.status).toBe(
      'scheduled',
    );
  });

  it('starts and submits history edit mode', async () => {
    await facade.loadBoard();
    const entry = {
      ...mockHistory[1],
      employeeName: 'Bruno East',
    };
    facade.beginHistoryEdit(entry);

    expect(facade.editingHistoryEntryId()).toBe('hist-2');
    expect(facade.jobLabelControl.value).toBe('Downtown');
    expect(facade.addressControl.value).toBe('2 Main St');
    expect(facade.canSubmitHistoryEdit()).toBe(true);

    await expect(facade.submitHistoryEdit('manager')).resolves.toBe(true);
    expect(dataService.updateCalls).toEqual(['hist-2']);
    expect(facade.editingHistoryEntryId()).toBeNull();
    expect(facade.saveState()).toBe('success');
    expect(facade.saveMessage()).toBe('Schedule updated.');
  });

  it('surfaces history edit failures', async () => {
    await facade.loadBoard();
    dataService.shouldFailUpdate = true;
    facade.beginHistoryEdit({
      ...mockHistory[1],
      employeeName: 'Bruno East',
    });

    await expect(facade.submitHistoryEdit()).resolves.toBe(false);
    expect(facade.saveState()).toBe('error');
    expect(facade.saveMessage()).toBe('Unable to update the schedule right now.');
  });

  it('cancels scheduled history entries and refreshes board', async () => {
    await facade.loadBoard();
    await expect(facade.cancelScheduledHistoryEntry('hist-2', 'manager')).resolves.toBe(true);

    expect(dataService.cancelCalls).toEqual(['hist-2']);
    expect(facade.saveState()).toBe('success');
    expect(facade.saveMessage()).toBe('Scheduled assignment cancelled.');
  });

  it('surfaces cancellation failures', async () => {
    await facade.loadBoard();
    dataService.shouldFailCancel = true;

    await expect(facade.cancelScheduledHistoryEntry('hist-2')).resolves.toBe(false);
    expect(facade.saveState()).toBe('error');
    expect(facade.saveMessage()).toBe('Unable to cancel the scheduled assignment right now.');
  });

  it('runs bulk complete flow and clears successful selections', async () => {
    dataService.history = [
      ...mockHistory,
      {
        id: 'hist-3',
        employeeId: 'emp-b',
        siteLabel: 'Outremont',
        address: '9 Side St',
        scheduledStart: '2026-03-21T18:00:00.000Z',
        scheduledEnd: '2026-03-21T19:00:00.000Z',
        hoursWorked: 1,
        status: 'scheduled',
      },
    ];
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-b');
    facade.toggleHistoryEntrySelection('hist-2');
    facade.toggleHistoryEntrySelection('hist-3');

    await expect(facade.completeSelectedHistoryEntries('manager')).resolves.toBe(true);
    expect(dataService.completeCalls).toEqual(['hist-2', 'hist-3']);
    expect(facade.selectedScheduledHistoryCount()).toBe(0);
    expect(facade.saveState()).toBe('success');
    expect(facade.saveMessage()).toContain('Completed 2 scheduled assignment(s).');
  });

  it('handles partial failures in bulk complete flow', async () => {
    dataService.history = [
      ...mockHistory,
      {
        id: 'hist-3',
        employeeId: 'emp-b',
        siteLabel: 'Outremont',
        address: '9 Side St',
        scheduledStart: '2026-03-21T18:00:00.000Z',
        scheduledEnd: '2026-03-21T19:00:00.000Z',
        hoursWorked: 1,
        status: 'scheduled',
      },
    ];
    dataService.shouldFailCompleteIds = new Set(['hist-3']);
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-b');
    facade.toggleHistoryEntrySelection('hist-2');
    facade.toggleHistoryEntrySelection('hist-3');

    await expect(facade.completeSelectedHistoryEntries()).resolves.toBe(false);
    expect(facade.saveState()).toBe('error');
    expect(facade.saveMessage()).toContain('Completed 1 of 2 scheduled assignments.');
    expect(facade.selectedHistoryEntryIds()).toEqual(['hist-3']);
  });

  it('requires at least one selected scheduled entry before bulk cancel', async () => {
    await facade.loadBoard();
    await expect(facade.cancelSelectedHistoryEntries()).resolves.toBe(false);
    expect(facade.saveState()).toBe('error');
    expect(facade.saveMessage()).toBe('Select at least one scheduled assignment to cancel.');
  });

  it('runs bulk cancel flow and clears successful selections', async () => {
    dataService.history = [
      ...mockHistory,
      {
        id: 'hist-3',
        employeeId: 'emp-b',
        siteLabel: 'Outremont',
        address: '9 Side St',
        scheduledStart: '2026-03-21T18:00:00.000Z',
        scheduledEnd: '2026-03-21T19:00:00.000Z',
        hoursWorked: 1,
        status: 'scheduled',
      },
    ];
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-b');
    facade.toggleHistoryEntrySelection('hist-2');
    facade.toggleHistoryEntrySelection('hist-3');

    await expect(facade.cancelSelectedHistoryEntries('manager')).resolves.toBe(true);
    expect(dataService.cancelCalls).toEqual(['hist-2', 'hist-3']);
    expect(facade.selectedScheduledHistoryCount()).toBe(0);
    expect(facade.saveState()).toBe('success');
    expect(facade.saveMessage()).toContain('Cancelled 2 scheduled assignment(s).');
  });

  it('handles partial failures in bulk cancel flow', async () => {
    dataService.history = [
      ...mockHistory,
      {
        id: 'hist-3',
        employeeId: 'emp-b',
        siteLabel: 'Outremont',
        address: '9 Side St',
        scheduledStart: '2026-03-21T18:00:00.000Z',
        scheduledEnd: '2026-03-21T19:00:00.000Z',
        hoursWorked: 1,
        status: 'scheduled',
      },
    ];
    dataService.shouldFailCancelIds = new Set(['hist-3']);
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-b');
    facade.toggleHistoryEntrySelection('hist-2');
    facade.toggleHistoryEntrySelection('hist-3');

    await expect(facade.cancelSelectedHistoryEntries()).resolves.toBe(false);
    expect(facade.saveState()).toBe('error');
    expect(facade.saveMessage()).toContain('Cancelled 1 of 2 scheduled assignments.');
    expect(facade.selectedHistoryEntryIds()).toEqual(['hist-3']);
  });

  it('resolves reassign target only when exactly one different active crew member is selected', async () => {
    await facade.loadBoard();
    const entry = {
      ...mockHistory[1],
      employeeName: 'Bruno East',
    };

    expect(facade.resolveReassignTarget(entry)).toBeNull();

    facade.toggleEmployeeSelection('emp-a');
    expect(facade.resolveReassignTarget(entry)).toEqual({
      employeeId: 'emp-a',
      fullName: 'Alex North',
    });

    facade.toggleEmployeeSelection('emp-c');
    expect(facade.resolveReassignTarget(entry)).toBeNull();
  });

  it('reassigns scheduled history entries and refreshes board', async () => {
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-a');
    const entry = {
      ...mockHistory[1],
      employeeName: 'Bruno East',
    };

    await expect(facade.reassignHistoryEntry(entry, 'manager')).resolves.toBe(true);
    expect(dataService.reassignCalls).toEqual([
      { entryId: 'hist-2', employeeId: 'emp-a' },
    ]);
    expect(facade.saveState()).toBe('success');
    expect(facade.saveMessage()).toContain('Alex North');
  });

  it('rejects reassign action without a valid target and surfaces API failures', async () => {
    await facade.loadBoard();
    const entry = {
      ...mockHistory[1],
      employeeName: 'Bruno East',
    };

    await expect(facade.reassignHistoryEntry(entry)).resolves.toBe(false);
    expect(facade.saveState()).toBe('error');
    expect(facade.saveMessage()).toContain('Select exactly one different active crew member');

    facade.toggleEmployeeSelection('emp-a');
    dataService.shouldFailReassign = true;
    const reassignPromise = facade.reassignHistoryEntry(entry);
    expect(facade.selectedCrewHistory().find((item) => item.id === 'hist-2')?.employeeId).toBe(
      'emp-a',
    );
    await expect(reassignPromise).resolves.toBe(false);
    expect(facade.saveMessage()).toBe('Unable to reassign the scheduled assignment right now.');
    facade.clearCrewSelection();
    facade.toggleEmployeeSelection('emp-b');
    expect(facade.selectedCrewHistory().find((item) => item.id === 'hist-2')?.employeeId).toBe(
      'emp-b',
    );
  });
});
