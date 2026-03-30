import { FormControl } from '@angular/forms';
import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { EmployeesDataService } from '../employees/employees-data.service.js';
import type {
  EmployeeLoggedJobOption,
  EmployeeJobHistoryRecord,
  EmployeeOperatorRole,
  EmployeeStartNextJobAssignmentPayload,
  EmployeeStartNextJobReadiness,
} from '../employees/employees.types.js';
import type {
  AssignmentAnalyticsSnapshot,
  AssignmentAnalyticsExport,
  AssignmentDraftValidation,
  CrossRunTrendSnapshot,
  CrewConflict,
  EmployeeAssignmentTrendSnapshot,
  ReadinessPill,
  RouteAssignmentVarianceSnapshot,
  SelectedCrewHistoryItem,
  StartNextJobAnalyticsWindow,
  StartNextJobLoadState,
  StartNextJobSaveState,
} from './start-next-job.types.js';

interface OptimisticBoardSnapshot {
  readonly history: EmployeeJobHistoryRecord[];
  readonly readiness: EmployeeStartNextJobReadiness[];
  readonly selectedHistoryEntryIds: string[];
}

const normalizeText = (value: string): string => value.trim().toLowerCase();
const toTimestamp = (value: string): number | null => {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};
const overlapsRange = (startA: number, endA: number, startB: number, endB: number): boolean =>
  startA < endB && endA > startB;
const toIsoDateTime = (value: string): string => new Date(value).toISOString();
const sortHistoryByStartDesc = (
  left: EmployeeJobHistoryRecord,
  right: EmployeeJobHistoryRecord,
): number => right.scheduledStart.localeCompare(left.scheduledStart);
const toDateTimeLocal = (value: string): string => {
  const date = new Date(value);
  const pad = (segment: number): string => segment.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const toDateInputTimestamp = (value: string, endOfDay: boolean): number | null => {
  if (!value) {
    return null;
  }
  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
  const timestamp = Date.parse(`${value}${suffix}`);
  return Number.isNaN(timestamp) ? null : timestamp;
};
const toDateInputValue = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const escapeCsvCell = (value: string | number): string => {
  const normalized = String(value).replace(/"/g, '""');
  return `"${normalized}"`;
};
const MANUAL_JOB_MODE = '__manual__';

@Injectable()
export class StartNextJobFacade {
  private readonly employeesData = inject(EmployeesDataService);

  readonly headingId = 'start-next-job-heading';
  readonly manualJobModeValue = MANUAL_JOB_MODE;

  readonly queryControl = new FormControl('', { nonNullable: true });
  readonly linkedJobEntryIdControl = new FormControl('', { nonNullable: true });
  readonly jobLabelControl = new FormControl('', { nonNullable: true });
  readonly addressControl = new FormControl('', { nonNullable: true });
  readonly scheduledStartControl = new FormControl('', { nonNullable: true });
  readonly scheduledEndControl = new FormControl('', { nonNullable: true });
  readonly analyticsStartDateControl = new FormControl('', { nonNullable: true });
  readonly analyticsEndDateControl = new FormControl('', { nonNullable: true });
  private readonly analyticsStartDateValue = toSignal(this.analyticsStartDateControl.valueChanges, {
    initialValue: this.analyticsStartDateControl.value,
  });
  private readonly analyticsEndDateValue = toSignal(this.analyticsEndDateControl.valueChanges, {
    initialValue: this.analyticsEndDateControl.value,
  });
  readonly analyticsWindow = signal<StartNextJobAnalyticsWindow>('30d');
  readonly showCompletedJobOptions = signal(false);

  readonly loadState = signal<StartNextJobLoadState>('loading');
  readonly errorMessage = signal('');
  readonly saveState = signal<StartNextJobSaveState>('idle');
  readonly saveMessage = signal('');
  readonly editingHistoryEntryId = signal<string | null>(null);

  private readonly readinessSignal = signal<EmployeeStartNextJobReadiness[]>([]);
  private readonly historySignal = signal<EmployeeJobHistoryRecord[]>([]);
  private readonly loggedJobOptionsSignal = signal<EmployeeLoggedJobOption[]>([]);
  private readonly selectedEmployeeIdsSignal = signal<string[]>([]);
  private readonly selectedHistoryEntryIdsSignal = signal<string[]>([]);

  constructor() {
    this.setAnalyticsWindow('30d');
  }

  readonly readinessSnapshot = computed(() => this.readinessSignal());
  readonly loggedJobOptions = computed(() => this.loggedJobOptionsSignal());
  readonly loggedJobStatusCounts = computed(() => {
    const options = this.loggedJobOptions();
    return {
      scheduled: options.filter((option) => option.status === 'scheduled').length,
      late: options.filter((option) => option.status === 'late').length,
      completed: options.filter((option) => option.status === 'completed').length,
    };
  });
  readonly visibleLoggedJobOptions = computed(() => {
    const includeCompleted = this.showCompletedJobOptions();
    const selectedEntryId = this.linkedJobEntryIdControl.value.trim();
    return this.loggedJobOptions().filter((option) => {
      if (option.entryId === selectedEntryId) {
        return true;
      }
      if (includeCompleted) {
        return true;
      }
      return option.status !== 'completed';
    });
  });
  readonly visibleCompletedLoggedJobOptions = computed(() =>
    this.visibleLoggedJobOptions().filter((option) => option.status === 'completed'),
  );
  readonly visibleDefaultLoggedJobOptions = computed(() =>
    this.visibleLoggedJobOptions().filter((option) => option.status !== 'completed'),
  );
  readonly hasVisibleLoggedJobOptions = computed(
    () => this.visibleLoggedJobOptions().length > 0,
  );
  readonly selectedLinkedJob = computed(() => {
    const entryId = this.linkedJobEntryIdControl.value.trim();
    if (!entryId || entryId === MANUAL_JOB_MODE) {
      return null;
    }
    return this.loggedJobOptions().find((option) => option.entryId === entryId) ?? null;
  });
  readonly hasJobModeSelection = computed(() => {
    if (this.editingHistoryEntryId()) {
      return true;
    }
    const entryId = this.linkedJobEntryIdControl.value.trim();
    if (!entryId) {
      return false;
    }
    if (entryId === MANUAL_JOB_MODE) {
      return true;
    }
    return this.loggedJobOptions().some((option) => option.entryId === entryId);
  });
  readonly isManualJobSelection = computed(
    () => this.linkedJobEntryIdControl.value.trim() === MANUAL_JOB_MODE,
  );
  readonly hasLinkedJobSelection = computed(() => Boolean(this.selectedLinkedJob()));
  readonly selectedEmployeeIds = computed(() => this.selectedEmployeeIdsSignal());
  readonly selectedHistoryEntryIds = computed(() => this.selectedHistoryEntryIdsSignal());

  readonly filteredReadiness = computed(() => {
    const query = normalizeText(this.queryControl.value);
    if (!query) {
      return this.readinessSnapshot();
    }
    return this.readinessSnapshot().filter((employee) => {
      const searchText = normalizeText(
        `${employee.fullName} ${employee.lastCompletedSite ?? ''} ${employee.nextScheduledStart ?? ''}`,
      );
      return searchText.includes(query);
    });
  });

  readonly selectedCrew = computed(() => {
    const lookup = new Map(
      this.readinessSnapshot().map((employee) => [employee.employeeId, employee]),
    );
    return this.selectedEmployeeIds()
      .map((employeeId) => lookup.get(employeeId))
      .filter((employee): employee is EmployeeStartNextJobReadiness => Boolean(employee));
  });

  private readonly selectedCrewHistoryAll = computed<SelectedCrewHistoryItem[]>(() => {
    const selectedIds = new Set(this.selectedEmployeeIds());
    if (!selectedIds.size) {
      return [];
    }
    const nameLookup = new Map(
      this.readinessSnapshot().map((employee) => [employee.employeeId, employee.fullName]),
    );
    return this.historySignal()
      .filter((historyItem) => selectedIds.has(historyItem.employeeId))
      .map((historyItem) => ({
        ...historyItem,
        employeeName: nameLookup.get(historyItem.employeeId) ?? 'Unknown employee',
      }))
      .sort((left, right) => right.scheduledStart.localeCompare(left.scheduledStart));
  });

  readonly selectedCrewHistory = computed<SelectedCrewHistoryItem[]>(() => {
    return this.selectedCrewHistoryAll().slice(0, 12);
  });

  readonly scheduledHistoryEntries = computed<SelectedCrewHistoryItem[]>(() =>
    this.selectedCrewHistoryAll().filter((entry) => entry.status === 'scheduled'),
  );

  readonly scheduledHistoryCount = computed(() => this.scheduledHistoryEntries().length);

  readonly selectedScheduledHistoryEntries = computed<SelectedCrewHistoryItem[]>(() => {
    const selectedIds = this.selectedHistoryEntryIds();
    if (!selectedIds.length) {
      return [];
    }
    const historyLookup = new Map(this.scheduledHistoryEntries().map((entry) => [entry.id, entry]));
    return selectedIds
      .map((entryId) => historyLookup.get(entryId))
      .filter((entry): entry is SelectedCrewHistoryItem => Boolean(entry));
  });

  readonly selectedScheduledHistoryCount = computed(
    () => this.selectedScheduledHistoryEntries().length,
  );
  readonly analyticsRangeError = computed<string | null>(() => {
    const startTimestamp = toDateInputTimestamp(this.analyticsStartDateValue(), false);
    const endTimestamp = toDateInputTimestamp(this.analyticsEndDateValue(), true);
    if (startTimestamp !== null && endTimestamp !== null && startTimestamp > endTimestamp) {
      return 'Analytics start date must be before the end date.';
    }
    return null;
  });
  private readonly assignmentAnalyticsHistory = computed<SelectedCrewHistoryItem[]>(() => {
    if (this.analyticsRangeError()) {
      return [];
    }
    const startTimestamp = toDateInputTimestamp(this.analyticsStartDateValue(), false);
    const endTimestamp = toDateInputTimestamp(this.analyticsEndDateValue(), true);
    const history = this.selectedCrewHistoryAll();
    return history.filter((entry) => {
      const scheduledAt = toTimestamp(entry.scheduledStart);
      if (scheduledAt === null) {
        return false;
      }
      if (startTimestamp !== null && scheduledAt < startTimestamp) {
        return false;
      }
      if (endTimestamp !== null && scheduledAt > endTimestamp) {
        return false;
      }
      return true;
    });
  });

  readonly assignmentAnalytics = computed<AssignmentAnalyticsSnapshot>(() => {
    const history = this.assignmentAnalyticsHistory();
    const totalTracked = history.length;
    const scheduledCount = history.filter((entry) => entry.status === 'scheduled').length;
    const completedCount = history.filter((entry) => entry.status === 'completed').length;
    const cancelledCount = history.filter((entry) => entry.status === 'cancelled').length;
    const totalHours = history.reduce((sum, entry) => sum + entry.hoursWorked, 0);
    const averageHours = totalTracked ? Number((totalHours / totalTracked).toFixed(2)) : 0;
    const completionRate = totalTracked
      ? Number(((completedCount / totalTracked) * 100).toFixed(1))
      : 0;
    const cancellationRate = totalTracked
      ? Number(((cancelledCount / totalTracked) * 100).toFixed(1))
      : 0;
    const uniqueSites = new Set(
      history.map((entry) => `${normalizeText(entry.siteLabel)}|${normalizeText(entry.address)}`),
    ).size;

    return {
      totalTracked,
      scheduledCount,
      completedCount,
      cancelledCount,
      totalHours,
      averageHours,
      completionRate,
      cancellationRate,
      uniqueSites,
    };
  });
  readonly employeeTrendAnalytics = computed<EmployeeAssignmentTrendSnapshot[]>(() => {
    const groupedHistory = new Map<string, SelectedCrewHistoryItem[]>();
    for (const entry of this.assignmentAnalyticsHistory()) {
      const group = groupedHistory.get(entry.employeeId);
      if (group) {
        group.push(entry);
      } else {
        groupedHistory.set(entry.employeeId, [entry]);
      }
    }

    return Array.from(groupedHistory.entries())
      .map(([employeeId, entries]) => {
        const totalTracked = entries.length;
        const scheduledCount = entries.filter((entry) => entry.status === 'scheduled').length;
        const completedCount = entries.filter((entry) => entry.status === 'completed').length;
        const cancelledCount = entries.filter((entry) => entry.status === 'cancelled').length;
        const totalHours = entries.reduce((sum, entry) => sum + entry.hoursWorked, 0);
        const averageHours = totalTracked ? Number((totalHours / totalTracked).toFixed(2)) : 0;
        const completionRate = totalTracked
          ? Number(((completedCount / totalTracked) * 100).toFixed(1))
          : 0;
        const cancellationRate = totalTracked
          ? Number(((cancelledCount / totalTracked) * 100).toFixed(1))
          : 0;
        const latestEntry = entries.reduce((latest, current) =>
          current.scheduledStart > latest.scheduledStart ? current : latest,
        );

        return {
          employeeId,
          employeeName: latestEntry.employeeName,
          totalTracked,
          scheduledCount,
          completedCount,
          cancelledCount,
          totalHours,
          averageHours,
          completionRate,
          cancellationRate,
          lastScheduledStart: latestEntry.scheduledStart,
          lastSiteLabel: latestEntry.siteLabel,
          lastAddress: latestEntry.address,
        };
      })
      .sort(
        (left, right) =>
          right.totalHours - left.totalHours ||
          right.totalTracked - left.totalTracked ||
          left.employeeName.localeCompare(right.employeeName),
      );
  });
  readonly routeVarianceAnalytics = computed<RouteAssignmentVarianceSnapshot[]>(() => {
    const groupedHistory = new Map<string, SelectedCrewHistoryItem[]>();
    for (const entry of this.assignmentAnalyticsHistory()) {
      const routeId = `${normalizeText(entry.siteLabel)}|${normalizeText(entry.address)}`;
      const group = groupedHistory.get(routeId);
      if (group) {
        group.push(entry);
      } else {
        groupedHistory.set(routeId, [entry]);
      }
    }

    const overallAverageHours = this.assignmentAnalytics().averageHours;
    return Array.from(groupedHistory.entries())
      .map(([routeId, entries]) => {
        const totalTracked = entries.length;
        const scheduledCount = entries.filter((entry) => entry.status === 'scheduled').length;
        const completedCount = entries.filter((entry) => entry.status === 'completed').length;
        const cancelledCount = entries.filter((entry) => entry.status === 'cancelled').length;
        const totalHours = entries.reduce((sum, entry) => sum + entry.hoursWorked, 0);
        const averageHours = totalTracked ? Number((totalHours / totalTracked).toFixed(2)) : 0;
        const completionRate = totalTracked
          ? Number(((completedCount / totalTracked) * 100).toFixed(1))
          : 0;
        const cancellationRate = totalTracked
          ? Number(((cancelledCount / totalTracked) * 100).toFixed(1))
          : 0;
        const latestEntry = entries.reduce((latest, current) =>
          current.scheduledStart > latest.scheduledStart ? current : latest,
        );
        return {
          routeId,
          siteLabel: latestEntry.siteLabel,
          address: latestEntry.address,
          totalTracked,
          scheduledCount,
          completedCount,
          cancelledCount,
          totalHours,
          averageHours,
          completionRate,
          cancellationRate,
          averageHoursVariance: Number((averageHours - overallAverageHours).toFixed(2)),
          lastScheduledStart: latestEntry.scheduledStart,
        };
      })
      .sort(
        (left, right) =>
          right.totalTracked - left.totalTracked ||
          Math.abs(right.averageHoursVariance) - Math.abs(left.averageHoursVariance) ||
          right.totalHours - left.totalHours ||
          left.siteLabel.localeCompare(right.siteLabel),
      );
  });
  readonly crossRunTrends = computed<CrossRunTrendSnapshot[]>(() => {
    const groupedHistory = new Map<string, SelectedCrewHistoryItem[]>();
    for (const entry of this.assignmentAnalyticsHistory()) {
      const dateKey = entry.scheduledStart.slice(0, 10);
      const group = groupedHistory.get(dateKey);
      if (group) {
        group.push(entry);
      } else {
        groupedHistory.set(dateKey, [entry]);
      }
    }

    const points = Array.from(groupedHistory.entries())
      .map(([periodStart, entries]) => {
        const totalTracked = entries.length;
        const scheduledCount = entries.filter((entry) => entry.status === 'scheduled').length;
        const completedCount = entries.filter((entry) => entry.status === 'completed').length;
        const cancelledCount = entries.filter((entry) => entry.status === 'cancelled').length;
        const totalHours = entries.reduce((sum, entry) => sum + entry.hoursWorked, 0);
        const completionRate = totalTracked
          ? Number(((completedCount / totalTracked) * 100).toFixed(1))
          : 0;
        const cancellationRate = totalTracked
          ? Number(((cancelledCount / totalTracked) * 100).toFixed(1))
          : 0;
        const periodDate = new Date(`${periodStart}T00:00:00.000`);
        return {
          periodStart,
          periodLabel: periodDate.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          }),
          totalTracked,
          completedCount,
          cancelledCount,
          scheduledCount,
          totalHours: Number(totalHours.toFixed(2)),
          completionRate,
          cancellationRate,
          hoursShare: 0,
        };
      })
      .sort((left, right) => left.periodStart.localeCompare(right.periodStart));

    const maxHours = points.reduce((max, point) => Math.max(max, point.totalHours), 0);
    return points.map((point) => ({
      ...point,
      hoursShare: maxHours ? Number(((point.totalHours / maxHours) * 100).toFixed(1)) : 0,
    }));
  });
  readonly canExportAssignmentAnalytics = computed(
    () => this.assignmentAnalyticsHistory().length > 0,
  );

  readonly selectedCrewConflicts = computed<CrewConflict[]>(() => {
    const startTimestamp = toTimestamp(this.scheduledStartControl.value);
    const endTimestamp = toTimestamp(this.scheduledEndControl.value);
    return this.selectedCrew().flatMap((employee) =>
      this.buildConflictsForEmployee(employee, startTimestamp, endTimestamp),
    );
  });

  readonly draftValidation = computed<AssignmentDraftValidation>(() => {
    const blockingReasons: string[] = [];
    if (!this.editingHistoryEntryId() && !this.hasJobModeSelection()) {
      blockingReasons.push('Select a linked job mode (linked client job or manual mode).');
    }
    if (!this.jobLabelControl.value.trim()) {
      blockingReasons.push('Job label is required.');
    }
    if (!this.addressControl.value.trim()) {
      blockingReasons.push('Job address is required.');
    }
    const startTimestamp = toTimestamp(this.scheduledStartControl.value);
    const endTimestamp = toTimestamp(this.scheduledEndControl.value);
    if (!startTimestamp || !endTimestamp) {
      blockingReasons.push('Scheduled start and end are required.');
    } else if (endTimestamp <= startTimestamp) {
      blockingReasons.push('Scheduled end must be after scheduled start.');
    }
    if (!this.selectedEmployeeIds().length) {
      blockingReasons.push('Select at least one employee for the crew.');
    }
    if (this.selectedCrewConflicts().length) {
      blockingReasons.push('Resolve crew conflicts before creating the assignment draft.');
    }
    return {
      isReady: blockingReasons.length === 0,
      blockingReasons,
    };
  });

  async loadBoard(): Promise<void> {
    this.loadState.set('loading');
    this.errorMessage.set('');
    try {
      const [readiness, history, loggedJobOptions] = await Promise.all([
        this.employeesData.listStartNextJobReadiness(),
        this.employeesData.listJobHistoryEntries(),
        this.employeesData.listLoggedJobOptions(),
      ]);
      const sortedReadiness = [...readiness].sort((left, right) =>
        left.fullName.localeCompare(right.fullName),
      );
      const sortedHistory = [...history].sort(sortHistoryByStartDesc);
      const sortedJobOptions = [...loggedJobOptions].sort((left, right) =>
        right.scheduledStart.localeCompare(left.scheduledStart),
      );
      this.readinessSignal.set(sortedReadiness);
      this.historySignal.set(sortedHistory);
      this.loggedJobOptionsSignal.set(sortedJobOptions);
      const allowedIds = new Set(sortedReadiness.map((employee) => employee.employeeId));
      this.selectedEmployeeIdsSignal.update((selectedIds) =>
        selectedIds.filter((employeeId) => allowedIds.has(employeeId)),
      );
      const allowedHistoryIds = new Set(
        sortedHistory.filter((entry) => entry.status === 'scheduled').map((entry) => entry.id),
      );
      this.selectedHistoryEntryIdsSignal.update((selectedIds) =>
        selectedIds.filter((entryId) => allowedHistoryIds.has(entryId)),
      );
      if (this.linkedJobEntryIdControl.value.trim()) {
        const selectedJobId = this.linkedJobEntryIdControl.value.trim();
        const hasLinkedJob =
          selectedJobId === MANUAL_JOB_MODE ||
          sortedJobOptions.some((option) => option.entryId === selectedJobId);
        if (!hasLinkedJob) {
          this.linkedJobEntryIdControl.setValue('', { emitEvent: false });
        }
      }
      this.loadState.set('ready');
    } catch {
      this.loadState.set('error');
      this.errorMessage.set('Unable to load Start Next Job data right now.');
    }
  }

  isEmployeeSelected(employeeId: string): boolean {
    return this.selectedEmployeeIds().includes(employeeId);
  }

  toggleEmployeeSelection(employeeId: string): void {
    this.clearSaveFeedback();
    this.selectedEmployeeIdsSignal.update((selectedIds) => {
      if (selectedIds.includes(employeeId)) {
        return selectedIds.filter((id) => id !== employeeId);
      }
      return [...selectedIds, employeeId];
    });
    this.selectedHistoryEntryIdsSignal.set([]);
  }

  clearCrewSelection(): void {
    this.clearSaveFeedback();
    this.selectedEmployeeIdsSignal.set([]);
    this.selectedHistoryEntryIdsSignal.set([]);
  }

  applyLinkedJobSelection(): void {
    this.clearSaveFeedback();
    const selectedJobId = this.linkedJobEntryIdControl.value.trim();
    if (!selectedJobId || selectedJobId === MANUAL_JOB_MODE) {
      return;
    }
    const selectedJob = this.selectedLinkedJob();
    if (!selectedJob) {
      return;
    }
    this.jobLabelControl.setValue(selectedJob.siteLabel, { emitEvent: false });
    this.addressControl.setValue(selectedJob.address, { emitEvent: false });
    this.scheduledStartControl.setValue(toDateTimeLocal(selectedJob.scheduledStart), {
      emitEvent: false,
    });
    this.scheduledEndControl.setValue(toDateTimeLocal(selectedJob.scheduledEnd), {
      emitEvent: false,
    });
  }

  toggleCompletedJobOptions(): void {
    this.showCompletedJobOptions.update((current) => !current);
  }

  isHistoryEntrySelected(entryId: string): boolean {
    return this.selectedHistoryEntryIds().includes(entryId);
  }

  toggleHistoryEntrySelection(entryId: string): void {
    this.clearSaveFeedback();
    this.selectedHistoryEntryIdsSignal.update((selectedIds) => {
      if (selectedIds.includes(entryId)) {
        return selectedIds.filter((id) => id !== entryId);
      }
      return [...selectedIds, entryId];
    });
  }

  clearHistorySelection(): void {
    this.clearSaveFeedback();
    this.selectedHistoryEntryIdsSignal.set([]);
  }

  clearAnalyticsDateRange(): void {
    this.analyticsWindow.set('custom');
    this.analyticsStartDateControl.setValue('');
    this.analyticsEndDateControl.setValue('');
  }

  setAnalyticsWindow(window: StartNextJobAnalyticsWindow, now = new Date()): void {
    this.analyticsWindow.set(window);
    if (window === 'custom') {
      return;
    }

    const end = new Date(now);
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    const lookbackDays = window === '7d' ? 6 : window === '30d' ? 29 : 89;
    start.setDate(start.getDate() - lookbackDays);
    this.analyticsStartDateControl.setValue(toDateInputValue(start));
    this.analyticsEndDateControl.setValue(toDateInputValue(end));
  }

  markAnalyticsWindowCustom(): void {
    if (this.analyticsWindow() === 'custom') {
      return;
    }
    this.analyticsWindow.set('custom');
  }

  async submitAssignment(actorRole: EmployeeOperatorRole = 'owner'): Promise<boolean> {
    const validation = this.draftValidation();
    if (!validation.isReady) {
      this.saveState.set('error');
      this.saveMessage.set(validation.blockingReasons[0] ?? 'Assignment draft is invalid.');
      return false;
    }

    this.saveState.set('saving');
    this.saveMessage.set('Saving assignment...');
    const payload = this.buildAssignmentPayload();
    try {
      const result = await this.employeesData.createStartNextJobAssignment(payload, actorRole);
      this.applyHistoryUpserts(result.createdHistory);
      this.saveState.set('success');
      this.saveMessage.set(`Assignment saved for ${result.createdHistory.length} crew member(s).`);
      this.resetDraftAfterSave();
      return true;
    } catch {
      this.saveState.set('error');
      this.saveMessage.set('Unable to save assignment right now.');
      return false;
    }
  }

  beginHistoryEdit(entry: SelectedCrewHistoryItem): void {
    if (entry.status !== 'scheduled') {
      return;
    }
    this.editingHistoryEntryId.set(entry.id);
    this.linkedJobEntryIdControl.setValue(entry.jobEntryId ?? MANUAL_JOB_MODE, {
      emitEvent: false,
    });
    this.jobLabelControl.setValue(entry.siteLabel, { emitEvent: false });
    this.addressControl.setValue(entry.address, { emitEvent: false });
    this.scheduledStartControl.setValue(toDateTimeLocal(entry.scheduledStart), {
      emitEvent: false,
    });
    this.scheduledEndControl.setValue(toDateTimeLocal(entry.scheduledEnd), {
      emitEvent: false,
    });
    this.saveState.set('idle');
    this.saveMessage.set('');
  }

  cancelHistoryEdit(): void {
    this.editingHistoryEntryId.set(null);
    this.clearSaveFeedback();
  }

  isEditingHistoryEntry(entryId: string): boolean {
    return this.editingHistoryEntryId() === entryId;
  }

  canSubmitHistoryEdit(): boolean {
    if (!this.editingHistoryEntryId()) {
      return false;
    }
    if (!this.jobLabelControl.value.trim() || !this.addressControl.value.trim()) {
      return false;
    }
    const startTimestamp = toTimestamp(this.scheduledStartControl.value);
    const endTimestamp = toTimestamp(this.scheduledEndControl.value);
    if (!startTimestamp || !endTimestamp) {
      return false;
    }
    return endTimestamp > startTimestamp;
  }

  async submitHistoryEdit(actorRole: EmployeeOperatorRole = 'owner'): Promise<boolean> {
    const entryId = this.editingHistoryEntryId();
    if (!entryId || !this.canSubmitHistoryEdit()) {
      this.saveState.set('error');
      this.saveMessage.set('Provide a valid schedule update before saving.');
      return false;
    }

    const existing = this.historySignal().find((entry) => entry.id === entryId);
    if (!existing) {
      this.saveState.set('error');
      this.saveMessage.set('Unable to find this scheduled assignment anymore.');
      return false;
    }

    const nextScheduledStart = toIsoDateTime(this.scheduledStartControl.value);
    const nextScheduledEnd = toIsoDateTime(this.scheduledEndControl.value);
    const optimisticEntry: EmployeeJobHistoryRecord = {
      ...existing,
      siteLabel: this.jobLabelControl.value.trim(),
      address: this.addressControl.value.trim(),
      scheduledStart: nextScheduledStart,
      scheduledEnd: nextScheduledEnd,
      hoursWorked: this.estimateHoursFromRange(nextScheduledStart, nextScheduledEnd),
    };
    const snapshot = this.captureBoardSnapshot();

    this.saveState.set('saving');
    this.saveMessage.set('Saving schedule update...');
    this.applyHistoryUpserts([optimisticEntry]);
    try {
      const updated = await this.employeesData.updateScheduledHistoryEntry(
        entryId,
        {
          siteLabel: optimisticEntry.siteLabel,
          address: optimisticEntry.address,
          scheduledStart: nextScheduledStart,
          scheduledEnd: nextScheduledEnd,
        },
        actorRole,
      );
      this.applyHistoryUpserts([updated]);
      this.editingHistoryEntryId.set(null);
      this.saveState.set('success');
      this.saveMessage.set('Schedule updated.');
      return true;
    } catch {
      this.restoreBoardSnapshot(snapshot);
      this.saveState.set('error');
      this.saveMessage.set('Unable to update the schedule right now.');
      return false;
    }
  }

  async cancelScheduledHistoryEntry(
    entryId: string,
    actorRole: EmployeeOperatorRole = 'owner',
  ): Promise<boolean> {
    const existing = this.historySignal().find((entry) => entry.id === entryId);
    if (!existing) {
      this.saveState.set('error');
      this.saveMessage.set('Unable to find this scheduled assignment anymore.');
      return false;
    }
    const snapshot = this.captureBoardSnapshot();

    this.saveState.set('saving');
    this.saveMessage.set('Cancelling scheduled assignment...');
    this.removeSelectedHistoryIds([entryId]);
    this.applyHistoryUpserts([
      {
        ...existing,
        status: 'cancelled',
      },
    ]);
    try {
      const cancelled = await this.employeesData.cancelScheduledHistoryEntry(entryId, actorRole);
      this.applyHistoryUpserts([cancelled]);
      if (this.editingHistoryEntryId() === entryId) {
        this.editingHistoryEntryId.set(null);
      }
      this.saveState.set('success');
      this.saveMessage.set('Scheduled assignment cancelled.');
      return true;
    } catch {
      this.restoreBoardSnapshot(snapshot);
      this.saveState.set('error');
      this.saveMessage.set('Unable to cancel the scheduled assignment right now.');
      return false;
    }
  }

  resolveReassignTarget(entry: SelectedCrewHistoryItem): {
    employeeId: string;
    fullName: string;
  } | null {
    if (entry.status !== 'scheduled') {
      return null;
    }
    const selected = this.selectedCrew();
    if (selected.length !== 1) {
      return null;
    }
    const [target] = selected;
    if (!target || target.employeeId === entry.employeeId) {
      return null;
    }
    if (target.status !== 'active') {
      return null;
    }
    return {
      employeeId: target.employeeId,
      fullName: target.fullName,
    };
  }

  async reassignHistoryEntry(
    entry: SelectedCrewHistoryItem,
    actorRole: EmployeeOperatorRole = 'owner',
  ): Promise<boolean> {
    const target = this.resolveReassignTarget(entry);
    if (!target) {
      this.saveState.set('error');
      this.saveMessage.set('Select exactly one different active crew member before reassigning.');
      return false;
    }

    const snapshot = this.captureBoardSnapshot();
    this.saveState.set('saving');
    this.saveMessage.set('Reassigning scheduled assignment...');
    this.removeSelectedHistoryIds([entry.id]);
    this.applyHistoryUpserts([
      {
        ...entry,
        employeeId: target.employeeId,
      },
    ]);
    try {
      const reassigned = await this.employeesData.reassignScheduledHistoryEntry(
        entry.id,
        {
          employeeId: target.employeeId,
        },
        actorRole,
      );
      this.applyHistoryUpserts([reassigned]);
      if (this.editingHistoryEntryId() === entry.id) {
        this.editingHistoryEntryId.set(null);
      }
      this.saveState.set('success');
      this.saveMessage.set(`Scheduled assignment moved to ${target.fullName}.`);
      return true;
    } catch {
      this.restoreBoardSnapshot(snapshot);
      this.saveState.set('error');
      this.saveMessage.set('Unable to reassign the scheduled assignment right now.');
      return false;
    }
  }

  async completeHistoryEntry(
    entryId: string,
    actorRole: EmployeeOperatorRole = 'owner',
  ): Promise<boolean> {
    const existing = this.historySignal().find((entry) => entry.id === entryId);
    if (!existing) {
      this.saveState.set('error');
      this.saveMessage.set('Unable to find this scheduled assignment anymore.');
      return false;
    }
    const snapshot = this.captureBoardSnapshot();

    this.saveState.set('saving');
    this.saveMessage.set('Marking assignment as completed...');
    this.removeSelectedHistoryIds([entryId]);
    this.applyHistoryUpserts([
      {
        ...existing,
        status: 'completed',
      },
    ]);
    try {
      const completed = await this.employeesData.completeJobHistoryEntry(entryId, actorRole);
      this.applyHistoryUpserts([completed]);
      this.saveState.set('success');
      this.saveMessage.set('Assignment marked as completed.');
      return true;
    } catch {
      this.restoreBoardSnapshot(snapshot);
      this.saveState.set('error');
      this.saveMessage.set('Unable to mark assignment as completed right now.');
      return false;
    }
  }

  async completeSelectedHistoryEntries(
    actorRole: EmployeeOperatorRole = 'owner',
  ): Promise<boolean> {
    const entries = this.selectedScheduledHistoryEntries();
    if (!entries.length) {
      this.saveState.set('error');
      this.saveMessage.set('Select at least one scheduled assignment to complete.');
      return false;
    }

    const snapshot = this.captureBoardSnapshot();
    const selectedIds = entries.map((entry) => entry.id);
    this.saveState.set('saving');
    this.saveMessage.set(`Completing ${entries.length} scheduled assignment(s)...`);
    this.selectedHistoryEntryIdsSignal.set([]);
    this.applyHistoryUpserts(
      entries.map((entry) => ({
        ...entry,
        status: 'completed',
      })),
    );
    const results = await Promise.allSettled(
      entries.map((entry) => this.employeesData.completeJobHistoryEntry(entry.id, actorRole)),
    );
    const succeededRecords = results
      .filter(
        (result): result is PromiseFulfilledResult<EmployeeJobHistoryRecord> =>
          result.status === 'fulfilled',
      )
      .map((result) => result.value);
    const succeededIds = new Set(succeededRecords.map((record) => record.id));
    const failedIds = selectedIds.filter((entryId) => !succeededIds.has(entryId));
    const failedCount = failedIds.length;

    if (succeededRecords.length) {
      this.applyHistoryUpserts(succeededRecords);
    }

    if (failedCount === 0) {
      this.saveState.set('success');
      this.saveMessage.set(`Completed ${entries.length} scheduled assignment(s).`);
      return true;
    }

    this.restoreHistoryEntries(snapshot.history, failedIds);
    this.selectedHistoryEntryIdsSignal.set(failedIds);
    this.saveState.set('error');
    this.saveMessage.set(
      `Completed ${succeededRecords.length} of ${entries.length} scheduled assignments. Retry the remaining ${failedCount}.`,
    );
    return false;
  }

  async cancelSelectedHistoryEntries(actorRole: EmployeeOperatorRole = 'owner'): Promise<boolean> {
    const entries = this.selectedScheduledHistoryEntries();
    if (!entries.length) {
      this.saveState.set('error');
      this.saveMessage.set('Select at least one scheduled assignment to cancel.');
      return false;
    }

    const snapshot = this.captureBoardSnapshot();
    const selectedIds = entries.map((entry) => entry.id);
    this.saveState.set('saving');
    this.saveMessage.set(`Cancelling ${entries.length} scheduled assignment(s)...`);
    this.selectedHistoryEntryIdsSignal.set([]);
    this.applyHistoryUpserts(
      entries.map((entry) => ({
        ...entry,
        status: 'cancelled',
      })),
    );
    const results = await Promise.allSettled(
      entries.map((entry) => this.employeesData.cancelScheduledHistoryEntry(entry.id, actorRole)),
    );
    const succeededRecords = results
      .filter(
        (result): result is PromiseFulfilledResult<EmployeeJobHistoryRecord> =>
          result.status === 'fulfilled',
      )
      .map((result) => result.value);
    const succeededIds = new Set(succeededRecords.map((record) => record.id));
    const failedIds = selectedIds.filter((entryId) => !succeededIds.has(entryId));
    const failedCount = failedIds.length;

    if (succeededRecords.length) {
      this.applyHistoryUpserts(succeededRecords);
    }

    if (failedCount === 0) {
      this.saveState.set('success');
      this.saveMessage.set(`Cancelled ${entries.length} scheduled assignment(s).`);
      return true;
    }

    this.restoreHistoryEntries(snapshot.history, failedIds);
    this.selectedHistoryEntryIdsSignal.set(failedIds);
    this.saveState.set('error');
    this.saveMessage.set(
      `Cancelled ${succeededRecords.length} of ${entries.length} scheduled assignments. Retry the remaining ${failedCount}.`,
    );
    return false;
  }

  getReadinessPill(readiness: EmployeeStartNextJobReadiness): ReadinessPill {
    if (readiness.readinessState === 'available') {
      return { text: 'Available', state: 'available' };
    }
    if (readiness.readinessState === 'scheduled') {
      return { text: 'Scheduled', state: 'scheduled' };
    }
    return { text: 'Inactive', state: 'inactive' };
  }

  trackByEmployeeId(_: number, employee: EmployeeStartNextJobReadiness): string {
    return employee.employeeId;
  }

  trackByCrewConflict(_: number, conflict: CrewConflict): string {
    return `${conflict.employeeId}:${conflict.reason}`;
  }

  trackByHistoryEntry(_: number, historyEntry: SelectedCrewHistoryItem): string {
    return historyEntry.id;
  }

  createAssignmentAnalyticsExport(now = new Date()): AssignmentAnalyticsExport | null {
    const history = this.assignmentAnalyticsHistory();
    if (!history.length) {
      return null;
    }
    const analytics = this.assignmentAnalytics();
    const dateStamp = now.toISOString().slice(0, 10);
    const startDate = this.analyticsStartDateValue();
    const endDate = this.analyticsEndDateValue();
    const analyticsWindow =
      startDate || endDate ? `${startDate || 'Any'} -> ${endDate || 'Any'}` : 'All dates';
    const employeeTrends = this.employeeTrendAnalytics();
    const routeVariance = this.routeVarianceAnalytics();
    const crossRunTrends = this.crossRunTrends();
    const csvLines = [
      `${escapeCsvCell('Metric')},${escapeCsvCell('Value')}`,
      `${escapeCsvCell('Analytics window')},${escapeCsvCell(analyticsWindow)}`,
      `${escapeCsvCell('Total tracked')},${escapeCsvCell(analytics.totalTracked)}`,
      `${escapeCsvCell('Scheduled')},${escapeCsvCell(analytics.scheduledCount)}`,
      `${escapeCsvCell('Completed')},${escapeCsvCell(analytics.completedCount)}`,
      `${escapeCsvCell('Cancelled')},${escapeCsvCell(analytics.cancelledCount)}`,
      `${escapeCsvCell('Total hours')},${escapeCsvCell(analytics.totalHours.toFixed(2))}`,
      `${escapeCsvCell('Average hours / entry')},${escapeCsvCell(analytics.averageHours.toFixed(2))}`,
      `${escapeCsvCell('Completion rate')},${escapeCsvCell(`${analytics.completionRate.toFixed(1)}%`)}`,
      `${escapeCsvCell('Cancellation rate')},${escapeCsvCell(`${analytics.cancellationRate.toFixed(1)}%`)}`,
      `${escapeCsvCell('Unique sites')},${escapeCsvCell(analytics.uniqueSites)}`,
      '',
      [
        'Entry ID',
        'Employee',
        'Status',
        'Site',
        'Address',
        'Scheduled start',
        'Scheduled end',
        'Hours',
      ]
        .map((value) => escapeCsvCell(value))
        .join(','),
      ...history.map((entry) =>
        [
          entry.id,
          entry.employeeName,
          entry.status,
          entry.siteLabel,
          entry.address,
          entry.scheduledStart,
          entry.scheduledEnd,
          entry.hoursWorked.toFixed(2),
        ]
          .map((value) => escapeCsvCell(value))
          .join(','),
      ),
      '',
      [
        'Employee',
        'Tracked',
        'Scheduled',
        'Completed',
        'Cancelled',
        'Total hours',
        'Average hours',
        'Completion rate',
        'Cancellation rate',
        'Last scheduled start',
        'Last site',
        'Last address',
      ]
        .map((value) => escapeCsvCell(value))
        .join(','),
      ...employeeTrends.map((trend) =>
        [
          trend.employeeName,
          trend.totalTracked,
          trend.scheduledCount,
          trend.completedCount,
          trend.cancelledCount,
          trend.totalHours.toFixed(2),
          trend.averageHours.toFixed(2),
          `${trend.completionRate.toFixed(1)}%`,
          `${trend.cancellationRate.toFixed(1)}%`,
          trend.lastScheduledStart ?? '--',
          trend.lastSiteLabel ?? '--',
          trend.lastAddress ?? '--',
        ]
          .map((value) => escapeCsvCell(value))
          .join(','),
      ),
      '',
      [
        'Route',
        'Address',
        'Tracked',
        'Scheduled',
        'Completed',
        'Cancelled',
        'Total hours',
        'Average hours',
        'Avg hours variance',
        'Completion rate',
        'Cancellation rate',
        'Last scheduled start',
      ]
        .map((value) => escapeCsvCell(value))
        .join(','),
      ...routeVariance.map((route) =>
        [
          route.siteLabel,
          route.address,
          route.totalTracked,
          route.scheduledCount,
          route.completedCount,
          route.cancelledCount,
          route.totalHours.toFixed(2),
          route.averageHours.toFixed(2),
          route.averageHoursVariance.toFixed(2),
          `${route.completionRate.toFixed(1)}%`,
          `${route.cancellationRate.toFixed(1)}%`,
          route.lastScheduledStart ?? '--',
        ]
          .map((value) => escapeCsvCell(value))
          .join(','),
      ),
      '',
      [
        'Period',
        'Tracked',
        'Scheduled',
        'Completed',
        'Cancelled',
        'Total hours',
        'Hours share',
        'Completion rate',
        'Cancellation rate',
      ]
        .map((value) => escapeCsvCell(value))
        .join(','),
      ...crossRunTrends.map((point) =>
        [
          point.periodLabel,
          point.totalTracked,
          point.scheduledCount,
          point.completedCount,
          point.cancelledCount,
          point.totalHours.toFixed(2),
          `${point.hoursShare.toFixed(1)}%`,
          `${point.completionRate.toFixed(1)}%`,
          `${point.cancellationRate.toFixed(1)}%`,
        ]
          .map((value) => escapeCsvCell(value))
          .join(','),
      ),
    ];
    return {
      filename: `start-next-job-assignment-analytics-${dateStamp}.csv`,
      csvContent: csvLines.join('\n'),
      rowCount: history.length,
    };
  }

  private buildConflictsForEmployee(
    employee: EmployeeStartNextJobReadiness,
    startTimestamp: number | null,
    endTimestamp: number | null,
  ): CrewConflict[] {
    const conflicts: CrewConflict[] = [];
    if (employee.status === 'inactive' || employee.readinessState === 'inactive') {
      conflicts.push({
        employeeId: employee.employeeId,
        employeeName: employee.fullName,
        reason: 'Employee is inactive.',
      });
      return conflicts;
    }
    if (employee.hasScheduleConflict) {
      conflicts.push({
        employeeId: employee.employeeId,
        employeeName: employee.fullName,
        reason: 'Existing overlap detected in upcoming schedule.',
      });
    }
    if (!startTimestamp || !endTimestamp) {
      return conflicts;
    }
    const blockedByNextAvailable =
      employee.nextAvailableAt && toTimestamp(employee.nextAvailableAt)
        ? startTimestamp < (toTimestamp(employee.nextAvailableAt) as number)
        : false;
    if (blockedByNextAvailable) {
      conflicts.push({
        employeeId: employee.employeeId,
        employeeName: employee.fullName,
        reason: 'Not available by the selected start time.',
      });
    }

    for (const window of employee.upcomingWindows) {
      const windowStart = toTimestamp(window.startAt);
      const windowEnd = toTimestamp(window.endAt);
      if (!windowStart || !windowEnd) {
        continue;
      }
      if (!overlapsRange(startTimestamp, endTimestamp, windowStart, windowEnd)) {
        continue;
      }
      conflicts.push({
        employeeId: employee.employeeId,
        employeeName: employee.fullName,
        reason: `Overlaps with "${window.siteLabel}" (${window.startAt} - ${window.endAt}).`,
      });
    }
    return conflicts;
  }

  private buildAssignmentPayload(): EmployeeStartNextJobAssignmentPayload {
    const linkedEntryId = this.linkedJobEntryIdControl.value.trim();
    return {
      jobLabel: this.jobLabelControl.value.trim(),
      address: this.addressControl.value.trim(),
      scheduledStart: toIsoDateTime(this.scheduledStartControl.value),
      scheduledEnd: toIsoDateTime(this.scheduledEndControl.value),
      employeeIds: this.selectedEmployeeIds(),
      jobEntryId: linkedEntryId && linkedEntryId !== MANUAL_JOB_MODE ? linkedEntryId : null,
    };
  }

  private estimateHoursFromRange(startIso: string, endIso: string): number {
    const startTimestamp = toTimestamp(startIso);
    const endTimestamp = toTimestamp(endIso);
    if (!startTimestamp || !endTimestamp || endTimestamp <= startTimestamp) {
      return 0;
    }
    return Math.max(0.25, Math.round(((endTimestamp - startTimestamp) / 3_600_000) * 4) / 4);
  }

  private captureBoardSnapshot(): OptimisticBoardSnapshot {
    return {
      history: [...this.historySignal()],
      readiness: [...this.readinessSignal()],
      selectedHistoryEntryIds: [...this.selectedHistoryEntryIds()],
    };
  }

  private restoreBoardSnapshot(snapshot: OptimisticBoardSnapshot): void {
    this.historySignal.set(snapshot.history);
    this.readinessSignal.set(snapshot.readiness);
    this.selectedHistoryEntryIdsSignal.set(snapshot.selectedHistoryEntryIds);
  }

  private applyHistoryUpserts(records: readonly EmployeeJobHistoryRecord[]): void {
    if (!records.length) {
      return;
    }
    const updates = new Map(records.map((record) => [record.id, record]));
    const nextHistory = this.historySignal().map((entry) => updates.get(entry.id) ?? entry);
    const knownIds = new Set(nextHistory.map((entry) => entry.id));
    for (const record of records) {
      if (!knownIds.has(record.id)) {
        nextHistory.unshift(record);
      }
    }
    this.historySignal.set(nextHistory.sort(sortHistoryByStartDesc));
    this.readinessSignal.set(this.rebuildReadinessFromHistory(nextHistory));
  }

  private restoreHistoryEntries(
    snapshotHistory: readonly EmployeeJobHistoryRecord[],
    entryIds: readonly string[],
  ): void {
    if (!entryIds.length) {
      return;
    }
    const restoreIds = new Set(entryIds);
    const snapshotLookup = new Map(
      snapshotHistory.filter((entry) => restoreIds.has(entry.id)).map((entry) => [entry.id, entry]),
    );
    this.applyHistoryUpserts(Array.from(snapshotLookup.values()));
  }

  private rebuildReadinessFromHistory(
    history: readonly EmployeeJobHistoryRecord[],
  ): EmployeeStartNextJobReadiness[] {
    return [...this.readinessSignal()]
      .map((record) => {
        const employeeHistory = history.filter((entry) => entry.employeeId === record.employeeId);
        const scheduledEntries = employeeHistory
          .filter((entry) => entry.status === 'scheduled')
          .sort((left, right) => left.scheduledStart.localeCompare(right.scheduledStart));
        const completedEntries = employeeHistory
          .filter((entry) => entry.status === 'completed')
          .sort((left, right) => right.scheduledEnd.localeCompare(left.scheduledEnd));

        const nextScheduled = scheduledEntries[0];
        const hasConflict = scheduledEntries.some((entry, index) => {
          const nextEntry = scheduledEntries[index + 1];
          if (!nextEntry) {
            return false;
          }
          return overlapsRange(
            toTimestamp(entry.scheduledStart) ?? 0,
            toTimestamp(entry.scheduledEnd) ?? 0,
            toTimestamp(nextEntry.scheduledStart) ?? 0,
            toTimestamp(nextEntry.scheduledEnd) ?? 0,
          );
        });
        const lastCompleted = completedEntries[0];
        const readinessState: EmployeeStartNextJobReadiness['readinessState'] =
          record.status === 'inactive'
            ? 'inactive'
            : scheduledEntries.length
              ? 'scheduled'
              : 'available';

        return {
          ...record,
          readinessState,
          scheduledJobsCount: scheduledEntries.length,
          completedJobsCount: completedEntries.length,
          scheduledHours: scheduledEntries.reduce((sum, entry) => sum + entry.hoursWorked, 0),
          completedHours: completedEntries.reduce((sum, entry) => sum + entry.hoursWorked, 0),
          nextScheduledStart: nextScheduled?.scheduledStart ?? null,
          nextScheduledEnd: nextScheduled?.scheduledEnd ?? null,
          nextAvailableAt:
            record.status === 'inactive' ? null : (nextScheduled?.scheduledEnd ?? null),
          lastCompletedAt: lastCompleted?.scheduledEnd ?? null,
          lastCompletedSite: lastCompleted?.siteLabel ?? null,
          hasScheduleConflict: hasConflict,
          upcomingWindows: scheduledEntries.map((entry) => ({
            jobId: entry.id,
            siteLabel: entry.siteLabel,
            address: entry.address,
            startAt: entry.scheduledStart,
            endAt: entry.scheduledEnd,
          })),
        };
      })
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
  }

  private resetDraftAfterSave(): void {
    this.selectedEmployeeIdsSignal.set([]);
    this.selectedHistoryEntryIdsSignal.set([]);
    this.queryControl.setValue('', { emitEvent: false });
    this.linkedJobEntryIdControl.setValue('', { emitEvent: false });
    this.jobLabelControl.setValue('', { emitEvent: false });
    this.addressControl.setValue('', { emitEvent: false });
    this.scheduledStartControl.setValue('', { emitEvent: false });
    this.scheduledEndControl.setValue('', { emitEvent: false });
  }

  private clearSaveFeedback(): void {
    if (this.saveState() === 'idle') {
      return;
    }
    this.saveState.set('idle');
    this.saveMessage.set('');
  }

  private removeSelectedHistoryIds(entryIds: readonly string[]): void {
    if (!entryIds.length) {
      return;
    }
    const removals = new Set(entryIds);
    this.selectedHistoryEntryIdsSignal.update((selectedIds) =>
      selectedIds.filter((entryId) => !removals.has(entryId)),
    );
  }
}
