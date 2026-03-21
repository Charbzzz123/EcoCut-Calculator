import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import type { CrewConflict, SelectedCrewHistoryItem } from './start-next-job.types.js';
import type { EmployeeStartNextJobReadiness } from '../employees/employees.types.js';
import { StartNextJobFacade } from './start-next-job.facade.js';
import { StartNextJobShellComponent } from './start-next-job-shell.component.js';

const employee: EmployeeStartNextJobReadiness = {
  employeeId: 'emp-1',
  fullName: 'Alex North',
  status: 'active',
  readinessState: 'available',
  scheduledJobsCount: 1,
  completedJobsCount: 2,
  scheduledHours: 3,
  completedHours: 7,
  nextScheduledStart: '2026-03-21T14:00:00.000Z',
  nextScheduledEnd: '2026-03-21T17:00:00.000Z',
  nextAvailableAt: '2026-03-21T17:00:00.000Z',
  lastCompletedAt: '2026-03-20T12:00:00.000Z',
  lastCompletedSite: 'Downtown',
  hasScheduleConflict: true,
  upcomingWindows: [],
};

const historyItem: SelectedCrewHistoryItem = {
  id: 'job-1',
  employeeId: 'emp-1',
  employeeName: 'Alex North',
  siteLabel: 'Downtown',
  address: '1 Main St',
  scheduledStart: '2026-03-21T14:00:00.000Z',
  scheduledEnd: '2026-03-21T15:00:00.000Z',
  hoursWorked: 1,
  status: 'scheduled',
};

const conflict: CrewConflict = {
  employeeId: 'emp-1',
  employeeName: 'Alex North',
  reason: 'Conflict',
};

const createFacadeStub = () => ({
  headingId: 'start-next-job-heading',
  queryControl: new FormControl('', { nonNullable: true }),
  jobLabelControl: new FormControl('', { nonNullable: true }),
  addressControl: new FormControl('', { nonNullable: true }),
  scheduledStartControl: new FormControl('', { nonNullable: true }),
  scheduledEndControl: new FormControl('', { nonNullable: true }),
  loadState: signal<'loading' | 'ready' | 'error'>('loading'),
  errorMessage: signal('Unable to load Start Next Job data right now.'),
  saveState: signal<'idle' | 'saving' | 'success' | 'error'>('idle'),
  saveMessage: signal(''),
  editingHistoryEntryId: signal<string | null>(null),
  filteredReadiness: signal<EmployeeStartNextJobReadiness[]>([]),
  selectedCrew: signal<EmployeeStartNextJobReadiness[]>([]),
  selectedCrewConflicts: signal<CrewConflict[]>([]),
  draftValidation: signal({
    isReady: false,
    blockingReasons: ['Job label is required.'],
  }),
  selectedCrewHistory: signal<SelectedCrewHistoryItem[]>([]),
  scheduledHistoryEntries: signal<SelectedCrewHistoryItem[]>([]),
  scheduledHistoryCount: signal(0),
  selectedScheduledHistoryEntries: signal<SelectedCrewHistoryItem[]>([]),
  selectedScheduledHistoryCount: signal(0),
  assignmentAnalytics: signal({
    totalTracked: 0,
    scheduledCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    totalHours: 0,
    averageHours: 0,
    completionRate: 0,
    cancellationRate: 0,
    uniqueSites: 0,
  }),
  loadBoard: vi.fn().mockResolvedValue(undefined),
  submitAssignment: vi.fn().mockResolvedValue(true),
  completeHistoryEntry: vi.fn().mockResolvedValue(true),
  completeSelectedHistoryEntries: vi.fn().mockResolvedValue(true),
  beginHistoryEdit: vi.fn(),
  cancelHistoryEdit: vi.fn(),
  submitHistoryEdit: vi.fn().mockResolvedValue(true),
  cancelScheduledHistoryEntry: vi.fn().mockResolvedValue(true),
  cancelSelectedHistoryEntries: vi.fn().mockResolvedValue(true),
  reassignHistoryEntry: vi.fn().mockResolvedValue(true),
  resolveReassignTarget: vi.fn().mockReturnValue(null),
  canSubmitHistoryEdit: vi.fn().mockReturnValue(true),
  isEditingHistoryEntry: vi.fn().mockReturnValue(false),
  clearCrewSelection: vi.fn(),
  clearHistorySelection: vi.fn(),
  toggleEmployeeSelection: vi.fn(),
  toggleHistoryEntrySelection: vi.fn(),
  isEmployeeSelected: vi.fn().mockReturnValue(false),
  isHistoryEntrySelected: vi.fn().mockReturnValue(false),
  getReadinessPill: vi.fn().mockReturnValue({ text: 'Available', state: 'available' }),
  trackByEmployeeId: (_: number, record: EmployeeStartNextJobReadiness) => record.employeeId,
  trackByCrewConflict: (_: number, value: CrewConflict) => `${value.employeeId}:${value.reason}`,
  trackByHistoryEntry: (_: number, value: SelectedCrewHistoryItem) => value.id,
});

describe('StartNextJobShellComponent', () => {
  let fixture: ComponentFixture<StartNextJobShellComponent>;
  let facade: ReturnType<typeof createFacadeStub>;

  beforeEach(async () => {
    facade = createFacadeStub();
    await TestBed.configureTestingModule({
      imports: [StartNextJobShellComponent],
      providers: [provideRouter([])],
    })
      .overrideComponent(StartNextJobShellComponent, {
        set: {
          providers: [{ provide: StartNextJobFacade, useValue: facade }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(StartNextJobShellComponent);
    fixture.detectChanges();
  });

  it('loads board data on init and renders loading state', () => {
    expect(facade.loadBoard).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Start Next Job');
    expect(fixture.nativeElement.textContent).toContain('Loading readiness data');
  });

  it('renders error state and allows retry', () => {
    facade.loadState.set('error');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Unable to load Start Next Job data right now.');
    const retry = fixture.nativeElement.querySelector('.state--error .ghost-btn') as HTMLButtonElement;
    retry.click();
    expect(facade.loadBoard).toHaveBeenCalledTimes(2);
  });

  it('renders ready state with empty crew list', () => {
    facade.loadState.set('ready');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No employees match this filter.');
  });

  it('renders crew cards, selected summary, conflicts, and history list', () => {
    facade.loadState.set('ready');
    facade.filteredReadiness.set([employee]);
    facade.selectedCrew.set([employee]);
    facade.selectedCrewConflicts.set([conflict]);
    facade.selectedCrewHistory.set([historyItem]);
    facade.scheduledHistoryEntries.set([historyItem]);
    facade.scheduledHistoryCount.set(1);
    facade.assignmentAnalytics.set({
      totalTracked: 1,
      scheduledCount: 1,
      completedCount: 0,
      cancelledCount: 0,
      totalHours: 1,
      averageHours: 1,
      completionRate: 0,
      cancellationRate: 0,
      uniqueSites: 1,
    });
    facade.draftValidation.set({ isReady: false, blockingReasons: ['Resolve conflicts'] });
    facade.isEmployeeSelected.mockReturnValue(true);
    facade.getReadinessPill.mockReturnValue({ text: 'Scheduled', state: 'scheduled' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Conflict in upcoming windows.');
    expect(fixture.nativeElement.textContent).toContain('Resolve the following conflicts');
    expect(fixture.nativeElement.textContent).toContain('Assignment analytics');
    expect(fixture.nativeElement.textContent).toContain('Total tracked');
    expect(fixture.nativeElement.textContent).toContain('Selected crew job history');
    expect(fixture.nativeElement.textContent).toContain('Downtown');

    const select = fixture.nativeElement.querySelector('.crew-select-btn') as HTMLButtonElement;
    select.click();
    expect(facade.toggleEmployeeSelection).toHaveBeenCalledWith('emp-1');

    const selectHistory = fixture.nativeElement.querySelector(
      '.history-card__actions .history-card__action--select',
    ) as HTMLButtonElement;
    selectHistory.click();
    expect(facade.toggleHistoryEntrySelection).toHaveBeenCalledWith('job-1');

    const edit = fixture.nativeElement.querySelectorAll(
      '.history-card__actions .history-card__action',
    )[1] as HTMLButtonElement;
    edit.click();
    expect(facade.beginHistoryEdit).toHaveBeenCalledWith(historyItem);

    const completeButton = fixture.nativeElement.querySelectorAll(
      '.history-card__actions .history-card__action',
    )[2] as HTMLButtonElement;
    completeButton.click();
    expect(facade.completeHistoryEntry).toHaveBeenCalledWith('job-1');

    const reassignHintButton = fixture.nativeElement.querySelector(
      '.history-card__action--info',
    ) as HTMLButtonElement;
    expect(reassignHintButton.disabled).toBe(true);

    const cancelButton = fixture.nativeElement.querySelector(
      '.history-card__actions .history-card__action--danger',
    ) as HTMLButtonElement;
    cancelButton.click();
    expect(facade.cancelScheduledHistoryEntry).toHaveBeenCalledWith('job-1');
  });

  it('renders bulk actions for scheduled history and forwards button events', () => {
    facade.loadState.set('ready');
    facade.selectedCrewHistory.set([historyItem]);
    facade.scheduledHistoryEntries.set([historyItem]);
    facade.scheduledHistoryCount.set(1);
    facade.selectedScheduledHistoryEntries.set([historyItem]);
    facade.selectedScheduledHistoryCount.set(1);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('1 of 1 scheduled selected');

    const bulkButtons = fixture.nativeElement.querySelectorAll('.history-bulk-actions .ghost-btn');
    (bulkButtons[0] as HTMLButtonElement).click();
    expect(facade.clearHistorySelection).toHaveBeenCalled();

    (bulkButtons[1] as HTMLButtonElement).click();
    expect(facade.completeSelectedHistoryEntries).toHaveBeenCalled();

    (bulkButtons[2] as HTMLButtonElement).click();
    expect(facade.cancelSelectedHistoryEntries).toHaveBeenCalled();
  });

  it('triggers reassign action when a valid target is selected', () => {
    facade.loadState.set('ready');
    facade.selectedCrewHistory.set([historyItem]);
    facade.resolveReassignTarget.mockReturnValue({
      employeeId: 'emp-2',
      fullName: 'Bruno East',
    });
    fixture.detectChanges();

    const reassignButton = fixture.nativeElement.querySelector(
      '.history-card__action--info',
    ) as HTMLButtonElement;
    expect(reassignButton.disabled).toBe(false);
    reassignButton.click();
    expect(facade.reassignHistoryEntry).toHaveBeenCalledWith(historyItem);
  });

  it('renders draft-ready branch and clear crew action', () => {
    facade.loadState.set('ready');
    facade.filteredReadiness.set([employee]);
    facade.draftValidation.set({ isReady: true, blockingReasons: [] });
    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector('.primary-btn') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
    saveButton.click();
    expect(facade.submitAssignment).toHaveBeenCalled();

    const clearButton = fixture.nativeElement.querySelector('.draft-actions .ghost-btn') as HTMLButtonElement;
    clearButton.click();
    expect(facade.clearCrewSelection).toHaveBeenCalled();
  });

  it('renders saving and feedback states for assignment submit', () => {
    facade.loadState.set('ready');
    facade.draftValidation.set({ isReady: true, blockingReasons: [] });
    facade.saveState.set('saving');
    facade.saveMessage.set('Saving assignment...');
    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector('.primary-btn') as HTMLButtonElement;
    expect(saveButton.textContent).toContain('Saving assignment');
    expect(saveButton.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.save-feedback')?.textContent).toContain(
      'Saving assignment',
    );
  });

  it('uses edit mode actions when a history entry is being edited', () => {
    facade.loadState.set('ready');
    facade.editingHistoryEntryId.set('job-1');
    facade.canSubmitHistoryEdit.mockReturnValue(true);
    fixture.detectChanges();

    const primary = fixture.nativeElement.querySelector('.primary-btn') as HTMLButtonElement;
    expect(primary.textContent).toContain('Save schedule update');
    primary.click();
    expect(facade.submitHistoryEdit).toHaveBeenCalled();

    const cancelEdit = fixture.nativeElement.querySelector(
      '.draft-actions .ghost-btn:nth-of-type(2)',
    ) as HTMLButtonElement;
    cancelEdit.click();
    expect(facade.cancelHistoryEdit).toHaveBeenCalled();
  });
});
