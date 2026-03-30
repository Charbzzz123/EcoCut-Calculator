import { TestBed } from '@angular/core/testing';
import { StartNextJobFacade } from './start-next-job.facade.js';
import { EmployeesDataService } from '../employees/employees-data.service.js';
import type {
  EmployeeLoggedJobOption,
  EmployeeJobHistoryRecord,
  EmployeeStartNextJobReadiness,
} from '../employees/employees.types.js';

class EmployeesDataServiceStub {
  readiness: EmployeeStartNextJobReadiness[] = [];
  history: EmployeeJobHistoryRecord[] = [];
  loggedJobOptions: EmployeeLoggedJobOption[] = [];
  shouldFail = false;
  shouldFailCreate = false;
  shouldFailComplete = false;
  shouldFailUpdate = false;
  shouldFailCancel = false;
  shouldFailReassign = false;
  shouldFailStartRun = false;
  shouldFailEndRun = false;
  shouldFailClockOut = false;
  shouldFailCompleteIds = new Set<string>();
  shouldFailCancelIds = new Set<string>();
  assignmentPayloads: unknown[] = [];
  completeCalls: string[] = [];
  updateCalls: string[] = [];
  cancelCalls: string[] = [];
  reassignCalls: { entryId: string; employeeId: string }[] = [];
  startRunCalls: string[] = [];
  endRunCalls: string[] = [];
  clockOutCalls: { entryId: string; reason: string | null }[] = [];

  private upsertHistory(record: EmployeeJobHistoryRecord): void {
    const nextHistory = this.history.filter((entry) => entry.id !== record.id);
    this.history = [record, ...nextHistory];
  }

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

  async listLoggedJobOptions(): Promise<EmployeeLoggedJobOption[]> {
    if (this.shouldFail) {
      throw new Error('failure');
    }
    return this.loggedJobOptions;
  }

  async createStartNextJobAssignment(payload: unknown) {
    if (this.shouldFailCreate) {
      throw new Error('save-failure');
    }
    this.assignmentPayloads.push(payload);
    const createdHistory: EmployeeJobHistoryRecord[] = [
      {
        id: 'created-history-1',
        employeeId: 'emp-a',
        siteLabel: 'Morning trim',
        address: '12 Crew St',
        scheduledStart: '2026-03-21T09:00:00.000Z',
        scheduledEnd: '2026-03-21T10:00:00.000Z',
        hoursWorked: 1,
        status: 'scheduled',
      },
    ];
    this.history = [...createdHistory, ...this.history];
    return {
      assignmentId: 'assign-1',
      createdHistory,
      createdHours: [],
    };
  }

  async completeJobHistoryEntry(entryId: string) {
    this.completeCalls.push(entryId);
    if (this.shouldFailComplete || this.shouldFailCompleteIds.has(entryId)) {
      throw new Error('complete-failure');
    }
    const completed: EmployeeJobHistoryRecord = {
      id: entryId,
      employeeId: 'emp-b',
      siteLabel: 'Downtown',
      address: '2 Main St',
      scheduledStart: '2026-03-21T14:00:00.000Z',
      scheduledEnd: '2026-03-21T17:00:00.000Z',
      hoursWorked: 3,
      status: 'completed',
    };
    this.upsertHistory(completed);
    return completed;
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
    const updated: EmployeeJobHistoryRecord = {
      id: entryId,
      employeeId: 'emp-b',
      siteLabel: payload.siteLabel,
      address: payload.address,
      scheduledStart: payload.scheduledStart,
      scheduledEnd: payload.scheduledEnd,
      hoursWorked: 2,
      status: 'scheduled',
    };
    this.upsertHistory(updated);
    return updated;
  }

  async cancelScheduledHistoryEntry(entryId: string) {
    this.cancelCalls.push(entryId);
    if (this.shouldFailCancel || this.shouldFailCancelIds.has(entryId)) {
      throw new Error('cancel-failure');
    }
    const cancelled: EmployeeJobHistoryRecord = {
      id: entryId,
      employeeId: 'emp-b',
      siteLabel: 'Downtown',
      address: '2 Main St',
      scheduledStart: '2026-03-21T14:00:00.000Z',
      scheduledEnd: '2026-03-21T17:00:00.000Z',
      hoursWorked: 3,
      status: 'cancelled',
    };
    this.upsertHistory(cancelled);
    return cancelled;
  }

  async reassignScheduledHistoryEntry(entryId: string, payload: { employeeId: string }) {
    this.reassignCalls.push({ entryId, employeeId: payload.employeeId });
    if (this.shouldFailReassign) {
      throw new Error('reassign-failure');
    }
    const reassigned: EmployeeJobHistoryRecord = {
      id: entryId,
      employeeId: payload.employeeId,
      siteLabel: 'Downtown',
      address: '2 Main St',
      scheduledStart: '2026-03-21T14:00:00.000Z',
      scheduledEnd: '2026-03-21T17:00:00.000Z',
      hoursWorked: 3,
      status: 'scheduled',
    };
    this.upsertHistory(reassigned);
    return reassigned;
  }

  async startAssignmentRun(entryId: string) {
    this.startRunCalls.push(entryId);
    if (this.shouldFailStartRun) {
      throw new Error('start-run-failure');
    }
    const updatedHistory: EmployeeJobHistoryRecord[] = [
      {
        id: entryId,
        employeeId: 'emp-b',
        siteLabel: 'Downtown',
        address: '2 Main St',
        scheduledStart: '2026-03-21T14:00:00.000Z',
        scheduledEnd: '2026-03-21T17:00:00.000Z',
        hoursWorked: 3,
        status: 'scheduled',
        runStartedAt: '2026-03-21T14:05:00.000Z',
        runEndedAt: null,
        assignmentId: 'assign-1',
      },
    ];
    this.history = [
      ...updatedHistory,
      ...this.history.filter((entry) => !updatedHistory.some((record) => record.id === entry.id)),
    ];
    return {
      assignmentId: 'assign-1',
      runStartedAt: '2026-03-21T14:05:00.000Z',
      runEndedAt: null,
      updatedHistory,
      updatedHours: [],
    };
  }

  async endAssignmentRun(entryId: string) {
    this.endRunCalls.push(entryId);
    if (this.shouldFailEndRun) {
      throw new Error('end-run-failure');
    }
    const updatedHistory: EmployeeJobHistoryRecord[] = [
      {
        id: entryId,
        employeeId: 'emp-b',
        siteLabel: 'Downtown',
        address: '2 Main St',
        scheduledStart: '2026-03-21T14:00:00.000Z',
        scheduledEnd: '2026-03-21T17:00:00.000Z',
        hoursWorked: 2,
        status: 'completed',
        runStartedAt: '2026-03-21T14:05:00.000Z',
        runEndedAt: '2026-03-21T16:10:00.000Z',
        assignmentId: 'assign-1',
      },
    ];
    this.history = [
      ...updatedHistory,
      ...this.history.filter((entry) => !updatedHistory.some((record) => record.id === entry.id)),
    ];
    return {
      assignmentId: 'assign-1',
      runStartedAt: '2026-03-21T14:05:00.000Z',
      runEndedAt: '2026-03-21T16:10:00.000Z',
      updatedHistory,
      updatedHours: [],
    };
  }

  async clockOutAssignmentMember(
    entryId: string,
    payload: {
      reason?: string;
    },
  ) {
    this.clockOutCalls.push({ entryId, reason: payload.reason?.trim() ?? null });
    if (this.shouldFailClockOut) {
      throw new Error('clock-out-failure');
    }
    const updatedHistory: EmployeeJobHistoryRecord[] = [
      {
        id: entryId,
        employeeId: 'emp-b',
        siteLabel: 'Downtown',
        address: '2 Main St',
        scheduledStart: '2026-03-21T14:00:00.000Z',
        scheduledEnd: '2026-03-21T17:00:00.000Z',
        hoursWorked: 1.5,
        status: 'completed',
        runStartedAt: '2026-03-21T14:05:00.000Z',
        runEndedAt: '2026-03-21T15:40:00.000Z',
        runClockOutReason: payload.reason ?? null,
        assignmentId: 'assign-1',
      },
    ];
    this.history = [
      ...updatedHistory,
      ...this.history.filter((entry) => !updatedHistory.some((record) => record.id === entry.id)),
    ];
    return {
      assignmentId: 'assign-1',
      runStartedAt: '2026-03-21T14:05:00.000Z',
      runEndedAt: null,
      updatedHistory,
      updatedHours: [],
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
    dataService.loggedJobOptions = [
      {
        entryId: 'entry-1',
        clientName: 'Alex North',
        siteLabel: 'Westmount Cedar Hedge',
        address: '1450 Pine Ave W',
        scheduledStart: '2026-03-20T13:00:00.000Z',
        scheduledEnd: '2026-03-20T17:00:00.000Z',
        status: 'scheduled',
      },
    ];

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

  it('loads linked job options and autofills draft details when a linked job is selected', async () => {
    await facade.loadBoard();

    expect(facade.loggedJobOptions()).toHaveLength(1);
    facade.linkedJobEntryIdControl.setValue('entry-1');
    facade.applyLinkedJobSelection();

    expect(facade.selectedLinkedJob()?.entryId).toBe('entry-1');
    expect(facade.hasLinkedJobSelection()).toBe(true);
    expect(facade.jobLabelControl.value).toBe('Westmount Cedar Hedge');
    expect(facade.addressControl.value).toBe('1450 Pine Ave W');
    expect(facade.scheduledStartControl.value).toContain('2026-03-20T');
    expect(facade.scheduledEndControl.value).toContain('2026-03-20T');
  });

  it('hides completed logged-job options by default and reveals them via advanced toggle', async () => {
    dataService.loggedJobOptions = [
      {
        entryId: 'entry-scheduled',
        clientName: 'Nora Bitar',
        siteLabel: 'NDG Maple Court',
        address: '2331 Sherbrooke St W',
        scheduledStart: '2099-03-24T12:00:00.000Z',
        scheduledEnd: '2099-03-24T15:00:00.000Z',
        status: 'scheduled',
      },
      {
        entryId: 'entry-late',
        clientName: 'Alex North',
        siteLabel: 'Westmount Cedar Hedge',
        address: '1450 Pine Ave W',
        scheduledStart: '2026-03-20T13:00:00.000Z',
        scheduledEnd: '2026-03-20T17:00:00.000Z',
        status: 'late',
      },
      {
        entryId: 'entry-completed',
        clientName: 'CJ AbiNassif',
        siteLabel: 'Hedge Trimming',
        address: '500 Park Ave',
        scheduledStart: '2026-03-19T12:00:00.000Z',
        scheduledEnd: '2026-03-19T16:00:00.000Z',
        status: 'completed',
      },
    ];

    await facade.loadBoard();

    expect(facade.loggedJobStatusCounts()).toEqual({
      scheduled: 1,
      late: 1,
      completed: 1,
    });
    expect(facade.visibleDefaultLoggedJobOptions().map((option) => option.entryId)).toEqual([
      'entry-scheduled',
      'entry-late',
    ]);
    expect(facade.visibleCompletedLoggedJobOptions()).toEqual([]);

    facade.toggleCompletedJobOptions();
    expect(facade.visibleCompletedLoggedJobOptions().map((option) => option.entryId)).toEqual([
      'entry-completed',
    ]);
  });

  it('requires continuity details when a completed linked job is selected', async () => {
    dataService.loggedJobOptions = [
      {
        entryId: 'entry-completed',
        clientName: 'CJ AbiNassif',
        siteLabel: 'Hedge Trimming',
        address: '500 Park Ave',
        scheduledStart: '2026-03-19T12:00:00.000Z',
        scheduledEnd: '2026-03-19T16:00:00.000Z',
        status: 'completed',
      },
    ];
    await facade.loadBoard();

    facade.toggleEmployeeSelection('emp-a');
    facade.toggleCompletedJobOptions();
    facade.linkedJobEntryIdControl.setValue('entry-completed');
    facade.applyLinkedJobSelection();

    expect(facade.requiresContinuityDetails()).toBe(true);
    expect(facade.linkedScheduleReadOnly()).toBe(false);
    expect(facade.draftValidation().blockingReasons).toContain(
      'Continuity category is required when using a completed linked job.',
    );
    expect(facade.draftValidation().blockingReasons).toContain(
      'Continuity reason is required when using a completed linked job.',
    );
  });

  it('includes continuity fields in assignment payload for completed linked jobs', async () => {
    dataService.loggedJobOptions = [
      {
        entryId: 'entry-completed',
        clientName: 'CJ AbiNassif',
        siteLabel: 'Hedge Trimming',
        address: '500 Park Ave',
        scheduledStart: '2026-03-19T12:00:00.000Z',
        scheduledEnd: '2026-03-19T16:00:00.000Z',
        status: 'completed',
      },
    ];
    await facade.loadBoard();

    facade.toggleEmployeeSelection('emp-a');
    facade.toggleCompletedJobOptions();
    facade.linkedJobEntryIdControl.setValue('entry-completed');
    facade.applyLinkedJobSelection();
    facade.scheduledStartControl.setValue('2026-03-21T09:00');
    facade.scheduledEndControl.setValue('2026-03-21T10:00');
    facade.continuityCategoryControl.setValue('issue_return');
    facade.continuityReasonControl.setValue('Customer reported missed section.');

    await expect(facade.submitAssignment('owner')).resolves.toBe(true);
    expect(dataService.assignmentPayloads[dataService.assignmentPayloads.length - 1]).toMatchObject({
      jobEntryId: 'entry-completed',
      continuityCategory: 'issue_return',
      continuityReason: 'Customer reported missed section.',
    });
  });

  it('accepts explicit manual job mode and submits payload without linked job id', async () => {
    await facade.loadBoard();

    facade.toggleEmployeeSelection('emp-a');
    facade.linkedJobEntryIdControl.setValue('__manual__');
    facade.applyLinkedJobSelection();
    facade.jobLabelControl.setValue('Manual follow-up');
    facade.addressControl.setValue('12 Crew St');
    facade.scheduledStartControl.setValue('2026-03-21T09:00');
    facade.scheduledEndControl.setValue('2026-03-21T10:00');

    await expect(facade.submitAssignment('owner')).resolves.toBe(true);
    expect(dataService.assignmentPayloads[dataService.assignmentPayloads.length - 1]).toMatchObject({
      jobLabel: 'Manual follow-up',
      jobEntryId: null,
    });
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
    expect(validation.blockingReasons).toContain(
      'Select a linked job mode (linked client job or manual mode).',
    );
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
    facade.linkedJobEntryIdControl.setValue('__manual__');
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

  it('builds an analytics CSV export for the selected crew context', async () => {
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-b');

    const exportPayload = facade.createAssignmentAnalyticsExport(
      new Date('2026-03-21T10:00:00.000Z'),
    );

    expect(exportPayload).not.toBeNull();
    expect(exportPayload?.filename).toBe('start-next-job-assignment-analytics-2026-03-21.csv');
    expect(exportPayload?.rowCount).toBe(1);
    expect(exportPayload?.csvContent).toContain('"Metric","Value"');
    expect(exportPayload?.csvContent).toContain('"Total tracked","1"');
    expect(exportPayload?.csvContent).toContain('"hist-2","Bruno East","scheduled"');
    expect(exportPayload?.csvContent).toContain('"Employee","Tracked","Scheduled"');
    expect(exportPayload?.csvContent).toContain('"Bruno East","1","1","0","0","3.00"');
    expect(exportPayload?.csvContent).toContain('"Route","Address","Tracked","Scheduled"');
    expect(exportPayload?.csvContent).toContain('"Downtown","2 Main St","1","1","0","0"');
    expect(exportPayload?.csvContent).toContain(
      '"Period","Tracked","Scheduled","Completed","Cancelled","Total hours","Hours share","Completion rate","Cancellation rate"',
    );
  });

  it('returns no analytics export when no crew has been selected', async () => {
    await facade.loadBoard();
    expect(facade.canExportAssignmentAnalytics()).toBe(false);
    expect(facade.createAssignmentAnalyticsExport()).toBeNull();
  });

  it('filters analytics by date range and includes range metadata in export', async () => {
    dataService.history = [
      {
        id: 'hist-20',
        employeeId: 'emp-b',
        siteLabel: 'Downtown',
        address: '2 Main St',
        scheduledStart: '2026-03-21T14:00:00.000Z',
        scheduledEnd: '2026-03-21T16:00:00.000Z',
        hoursWorked: 2,
        status: 'completed',
      },
      {
        id: 'hist-21',
        employeeId: 'emp-b',
        siteLabel: 'Outremont',
        address: '9 Side St',
        scheduledStart: '2026-02-10T09:00:00.000Z',
        scheduledEnd: '2026-02-10T11:00:00.000Z',
        hoursWorked: 2,
        status: 'cancelled',
      },
    ];
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-b');
    facade.analyticsStartDateControl.setValue('2026-03-01');
    facade.analyticsEndDateControl.setValue('2026-03-31');

    expect(facade.assignmentAnalytics()).toEqual({
      totalTracked: 1,
      scheduledCount: 0,
      completedCount: 1,
      cancelledCount: 0,
      totalHours: 2,
      averageHours: 2,
      completionRate: 100,
      cancellationRate: 0,
      uniqueSites: 1,
    });

    const exportPayload = facade.createAssignmentAnalyticsExport(
      new Date('2026-03-21T10:00:00.000Z'),
    );
    expect(exportPayload?.csvContent).toContain('"Analytics window","2026-03-01 -> 2026-03-31"');
    expect(exportPayload?.csvContent).toContain('"hist-20","Bruno East","completed"');
    expect(exportPayload?.csvContent).not.toContain('"hist-21","Bruno East","cancelled"');
  });

  it('builds per-employee trend analytics from selected crew history in range', async () => {
    dataService.history = [
      {
        id: 'hist-30',
        employeeId: 'emp-a',
        siteLabel: 'Westmount',
        address: '1 Main St',
        scheduledStart: '2026-03-21T10:00:00.000Z',
        scheduledEnd: '2026-03-21T12:00:00.000Z',
        hoursWorked: 2,
        status: 'completed',
      },
      {
        id: 'hist-31',
        employeeId: 'emp-b',
        siteLabel: 'Downtown',
        address: '2 Main St',
        scheduledStart: '2026-03-20T14:00:00.000Z',
        scheduledEnd: '2026-03-20T17:00:00.000Z',
        hoursWorked: 3,
        status: 'scheduled',
      },
      {
        id: 'hist-32',
        employeeId: 'emp-b',
        siteLabel: 'Outremont',
        address: '9 Side St',
        scheduledStart: '2026-03-10T09:00:00.000Z',
        scheduledEnd: '2026-03-10T11:00:00.000Z',
        hoursWorked: 2,
        status: 'cancelled',
      },
    ];
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-a');
    facade.toggleEmployeeSelection('emp-b');
    facade.analyticsStartDateControl.setValue('2026-03-15');
    facade.analyticsEndDateControl.setValue('2026-03-31');

    expect(facade.employeeTrendAnalytics()).toEqual([
      {
        employeeId: 'emp-b',
        employeeName: 'Bruno East',
        totalTracked: 1,
        scheduledCount: 1,
        completedCount: 0,
        cancelledCount: 0,
        totalHours: 3,
        averageHours: 3,
        completionRate: 0,
        cancellationRate: 0,
        lastScheduledStart: '2026-03-20T14:00:00.000Z',
        lastSiteLabel: 'Downtown',
        lastAddress: '2 Main St',
      },
      {
        employeeId: 'emp-a',
        employeeName: 'Alex North',
        totalTracked: 1,
        scheduledCount: 0,
        completedCount: 1,
        cancelledCount: 0,
        totalHours: 2,
        averageHours: 2,
        completionRate: 100,
        cancellationRate: 0,
        lastScheduledStart: '2026-03-21T10:00:00.000Z',
        lastSiteLabel: 'Westmount',
        lastAddress: '1 Main St',
      },
    ]);
  });

  it('builds route-level variance analytics from selected crew history in range', async () => {
    dataService.history = [
      {
        id: 'hist-40',
        employeeId: 'emp-a',
        siteLabel: 'Westmount',
        address: '1 Main St',
        scheduledStart: '2026-03-21T10:00:00.000Z',
        scheduledEnd: '2026-03-21T12:00:00.000Z',
        hoursWorked: 2,
        status: 'completed',
      },
      {
        id: 'hist-41',
        employeeId: 'emp-b',
        siteLabel: 'Downtown',
        address: '2 Main St',
        scheduledStart: '2026-03-20T14:00:00.000Z',
        scheduledEnd: '2026-03-20T18:00:00.000Z',
        hoursWorked: 4,
        status: 'scheduled',
      },
      {
        id: 'hist-42',
        employeeId: 'emp-b',
        siteLabel: 'Downtown',
        address: '2 Main St',
        scheduledStart: '2026-03-18T14:00:00.000Z',
        scheduledEnd: '2026-03-18T16:00:00.000Z',
        hoursWorked: 2,
        status: 'completed',
      },
    ];
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-a');
    facade.toggleEmployeeSelection('emp-b');
    facade.analyticsStartDateControl.setValue('2026-03-01');
    facade.analyticsEndDateControl.setValue('2026-03-31');

    expect(facade.routeVarianceAnalytics()).toEqual([
      {
        routeId: 'downtown|2 main st',
        siteLabel: 'Downtown',
        address: '2 Main St',
        totalTracked: 2,
        scheduledCount: 1,
        completedCount: 1,
        cancelledCount: 0,
        totalHours: 6,
        averageHours: 3,
        completionRate: 50,
        cancellationRate: 0,
        averageHoursVariance: 0.33,
        lastScheduledStart: '2026-03-20T14:00:00.000Z',
      },
      {
        routeId: 'westmount|1 main st',
        siteLabel: 'Westmount',
        address: '1 Main St',
        totalTracked: 1,
        scheduledCount: 0,
        completedCount: 1,
        cancelledCount: 0,
        totalHours: 2,
        averageHours: 2,
        completionRate: 100,
        cancellationRate: 0,
        averageHoursVariance: -0.67,
        lastScheduledStart: '2026-03-21T10:00:00.000Z',
      },
    ]);
  });

  it('builds cross-run trends from selected crew history in range', async () => {
    dataService.history = [
      {
        id: 'hist-50',
        employeeId: 'emp-a',
        siteLabel: 'Westmount',
        address: '1 Main St',
        scheduledStart: '2026-03-21T10:00:00.000Z',
        scheduledEnd: '2026-03-21T12:00:00.000Z',
        hoursWorked: 2,
        status: 'completed',
      },
      {
        id: 'hist-51',
        employeeId: 'emp-b',
        siteLabel: 'Downtown',
        address: '2 Main St',
        scheduledStart: '2026-03-21T14:00:00.000Z',
        scheduledEnd: '2026-03-21T18:00:00.000Z',
        hoursWorked: 4,
        status: 'scheduled',
      },
      {
        id: 'hist-52',
        employeeId: 'emp-b',
        siteLabel: 'Downtown',
        address: '2 Main St',
        scheduledStart: '2026-03-20T14:00:00.000Z',
        scheduledEnd: '2026-03-20T16:00:00.000Z',
        hoursWorked: 2,
        status: 'cancelled',
      },
    ];
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-a');
    facade.toggleEmployeeSelection('emp-b');
    facade.analyticsStartDateControl.setValue('2026-03-01');
    facade.analyticsEndDateControl.setValue('2026-03-31');

    const trends = facade.crossRunTrends();
    expect(trends).toHaveLength(2);
    expect(trends[0]).toMatchObject({
      periodStart: '2026-03-20',
      totalTracked: 1,
      completedCount: 0,
      cancelledCount: 1,
      scheduledCount: 0,
      totalHours: 2,
      completionRate: 0,
      cancellationRate: 100,
      hoursShare: 33.3,
    });
    expect(trends[0]?.periodLabel).toBeTruthy();
    expect(trends[1]).toMatchObject({
      periodStart: '2026-03-21',
      totalTracked: 2,
      completedCount: 1,
      cancelledCount: 0,
      scheduledCount: 1,
      totalHours: 6,
      completionRate: 50,
      cancellationRate: 0,
      hoursShare: 100,
    });
    expect(trends[1]?.periodLabel).toBeTruthy();
  });

  it('applies preset analytics windows and falls back to custom for manual edits', () => {
    facade.setAnalyticsWindow('7d', new Date('2026-03-22T12:00:00.000Z'));
    expect(facade.analyticsWindow()).toBe('7d');
    expect(facade.analyticsStartDateControl.value).toBe('2026-03-16');
    expect(facade.analyticsEndDateControl.value).toBe('2026-03-22');

    facade.markAnalyticsWindowCustom();
    expect(facade.analyticsWindow()).toBe('custom');

    facade.setAnalyticsWindow('custom');
    expect(facade.analyticsWindow()).toBe('custom');
  });

  it('guards analytics export when date range is invalid and clears range values', async () => {
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-b');
    facade.analyticsStartDateControl.setValue('2026-03-22');
    facade.analyticsEndDateControl.setValue('2026-03-21');

    expect(facade.analyticsRangeError()).toBe('Analytics start date must be before the end date.');
    expect(facade.assignmentAnalytics().totalTracked).toBe(0);
    expect(facade.canExportAssignmentAnalytics()).toBe(false);
    expect(facade.createAssignmentAnalyticsExport()).toBeNull();

    facade.clearAnalyticsDateRange();
    expect(facade.analyticsStartDateControl.value).toBe('');
    expect(facade.analyticsEndDateControl.value).toBe('');
    expect(facade.analyticsRangeError()).toBeNull();
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
    facade.linkedJobEntryIdControl.setValue('entry-1');
    facade.applyLinkedJobSelection();
    facade.jobLabelControl.setValue('Morning trim');
    facade.addressControl.setValue('12 Crew St');
    facade.scheduledStartControl.setValue('2026-03-21T09:00');
    facade.scheduledEndControl.setValue('2026-03-21T10:00');

    await expect(facade.submitAssignment('manager')).resolves.toBe(true);
    expect(dataService.assignmentPayloads).toHaveLength(1);
    expect(dataService.assignmentPayloads[0]).toMatchObject({
      jobLabel: 'Morning trim',
      address: '12 Crew St',
      employeeIds: ['emp-a'],
      jobEntryId: 'entry-1',
    });
    expect(dataService.assignmentPayloads[0]).toEqual(
      expect.objectContaining({
        scheduledStart: expect.any(String),
        scheduledEnd: expect.any(String),
      }),
    );
    expect(facade.saveState()).toBe('success');
    expect(facade.saveMessage()).toContain('Assignment saved for 1 crew member');
    expect(facade.selectedEmployeeIds()).toEqual([]);
    expect(facade.linkedJobEntryIdControl.value).toBe('');
    expect(facade.jobLabelControl.value).toBe('');
    expect(facade.addressControl.value).toBe('');
  });

  it('returns save error feedback when assignment mutation fails', async () => {
    await facade.loadBoard();
    dataService.shouldFailCreate = true;
    facade.toggleEmployeeSelection('emp-a');
    facade.linkedJobEntryIdControl.setValue('__manual__');
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

  it('starts and ends assignment runs from scheduled history entries', async () => {
    await facade.loadBoard();

    await expect(facade.startHistoryRun('hist-2', 'manager')).resolves.toBe(true);
    expect(dataService.startRunCalls).toEqual(['hist-2']);
    expect(facade.saveState()).toBe('success');
    expect(facade.saveMessage()).toBe('Run started. Crew clock-in is now active.');

    await expect(facade.endHistoryRun('hist-2', 'owner')).resolves.toBe(true);
    expect(dataService.endRunCalls).toEqual(['hist-2']);
    expect(facade.saveState()).toBe('success');
    expect(facade.saveMessage()).toBe('Run ended. Remaining crew members were clocked out.');
  });

  it('clocks out one active run member with optional note', async () => {
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-b');
    await facade.startHistoryRun('hist-2', 'manager');

    await expect(
      facade.clockOutHistoryMember('hist-2', 'Left early for appointment', 'owner'),
    ).resolves.toBe(true);
    expect(dataService.clockOutCalls).toEqual([
      { entryId: 'hist-2', reason: 'Left early for appointment' },
    ]);
    expect(facade.saveState()).toBe('success');
    expect(facade.saveMessage()).toBe('Crew member clocked out with note.');
    expect(facade.selectedCrewHistory().find((entry) => entry.id === 'hist-2')?.status).toBe(
      'completed',
    );
  });

  it('surfaces clock-out API failures and restores optimistic state', async () => {
    await facade.loadBoard();
    facade.toggleEmployeeSelection('emp-b');
    await facade.startHistoryRun('hist-2', 'owner');
    dataService.shouldFailClockOut = true;

    const clockOutPromise = facade.clockOutHistoryMember('hist-2');
    expect(facade.selectedCrewHistory().find((entry) => entry.id === 'hist-2')?.status).toBe(
      'completed',
    );
    await expect(clockOutPromise).resolves.toBe(false);
    expect(facade.saveState()).toBe('error');
    expect(facade.saveMessage()).toBe(
      'Unable to clock out this crew member right now.',
    );
    expect(facade.selectedCrewHistory().find((entry) => entry.id === 'hist-2')?.status).toBe(
      'scheduled',
    );
  });

  it('blocks editing when a run is already active', async () => {
    await facade.loadBoard();
    facade.beginHistoryEdit({
      ...mockHistory[1],
      runStartedAt: '2026-03-21T14:05:00.000Z',
      runEndedAt: null,
      employeeName: 'Bruno East',
    });

    expect(facade.editingHistoryEntryId()).toBeNull();
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
    expect(dataService.reassignCalls).toEqual([{ entryId: 'hist-2', employeeId: 'emp-a' }]);
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
