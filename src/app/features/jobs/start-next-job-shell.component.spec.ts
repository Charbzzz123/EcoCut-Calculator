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
  filteredReadiness: signal<EmployeeStartNextJobReadiness[]>([]),
  selectedCrew: signal<EmployeeStartNextJobReadiness[]>([]),
  selectedCrewConflicts: signal<CrewConflict[]>([]),
  draftValidation: signal({
    isReady: false,
    blockingReasons: ['Job label is required.'],
  }),
  selectedCrewHistory: signal<SelectedCrewHistoryItem[]>([]),
  loadBoard: vi.fn().mockResolvedValue(undefined),
  clearCrewSelection: vi.fn(),
  toggleEmployeeSelection: vi.fn(),
  isEmployeeSelected: vi.fn().mockReturnValue(false),
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
    facade.draftValidation.set({ isReady: false, blockingReasons: ['Resolve conflicts'] });
    facade.isEmployeeSelected.mockReturnValue(true);
    facade.getReadinessPill.mockReturnValue({ text: 'Scheduled', state: 'scheduled' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Conflict in upcoming windows.');
    expect(fixture.nativeElement.textContent).toContain('Resolve the following conflicts');
    expect(fixture.nativeElement.textContent).toContain('Selected crew job history');
    expect(fixture.nativeElement.textContent).toContain('Downtown');

    const select = fixture.nativeElement.querySelector('.crew-select-btn') as HTMLButtonElement;
    select.click();
    expect(facade.toggleEmployeeSelection).toHaveBeenCalledWith('emp-1');
  });

  it('renders draft-ready branch and clear crew action', () => {
    facade.loadState.set('ready');
    facade.filteredReadiness.set([employee]);
    facade.draftValidation.set({ isReady: true, blockingReasons: [] });
    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector('.primary-btn') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);

    const clearButton = fixture.nativeElement.querySelector('.draft-actions .ghost-btn') as HTMLButtonElement;
    clearButton.click();
    expect(facade.clearCrewSelection).toHaveBeenCalled();
  });
});
