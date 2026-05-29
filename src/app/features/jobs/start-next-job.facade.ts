import { HttpErrorResponse } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { EmployeesDataService } from '../employees/employees-data.service.js';
import {
  AddressLookupService,
  type AddressSuggestResponse,
  type AddressSuggestion,
} from '../../shared/domain/address/address-lookup.service.js';
import type {
  EmployeeContinuityCategory,
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
  OngoingRunSnapshot,
  OngoingRunState,
  ReadinessPill,
  RouteAssignmentVarianceSnapshot,
  SelectedCrewHistoryItem,
  StartNextJobDispatchMode,
  StartNextJobAnalyticsWindow,
  StartNextJobLoadState,
  StartNextJobSaveState,
} from './start-next-job.types.js';
import { computeHistoryLifecycleSummary } from '../../shared/domain/employees/history-lifecycle-metrics.js';
import { debounceTime, distinctUntilChanged, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';

interface OptimisticBoardSnapshot {
  readonly history: EmployeeJobHistoryRecord[];
  readonly readiness: EmployeeStartNextJobReadiness[];
  readonly selectedHistoryEntryIds: string[];
}

const normalizeText = (value: string): string => value.trim().toLowerCase();
const ADDRESS_LOOKUP_DEBOUNCE_MS = 3000;
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
const DEFAULT_SCHEDULE_DURATION_MS = 60 * 60 * 1000;
const continuityCategoryOptions: readonly {
  value: EmployeeContinuityCategory;
  label: string;
}[] = [
  { value: 'issue_return', label: 'Issue return' },
  { value: 'touch_up', label: 'Touch-up' },
  { value: 'client_change', label: 'Client change' },
  { value: 'weather_delay', label: 'Weather delay' },
  { value: 'access_issue', label: 'Access issue' },
  { value: 'other', label: 'Other' },
];

@Injectable()
export class StartNextJobFacade implements OnDestroy {
  private readonly employeesData = inject(EmployeesDataService);
  private readonly addressLookup = inject(AddressLookupService);
  private readonly enforceVerifiedAddress = environment.enforceVerifiedAddress;
  readonly addressVerificationRequired = this.enforceVerifiedAddress;

  readonly headingId = 'start-next-job-heading';
  readonly manualJobModeValue = MANUAL_JOB_MODE;

  readonly queryControl = new FormControl('', { nonNullable: true });
  readonly dispatchModeControl = new FormControl<StartNextJobDispatchMode>('start_now', {
    nonNullable: true,
  });
  readonly linkedJobEntryIdControl = new FormControl('', { nonNullable: true });
  readonly jobLabelControl = new FormControl('', { nonNullable: true });
  readonly addressControl = new FormControl('', { nonNullable: true });
  readonly scheduledStartControl = new FormControl('', { nonNullable: true });
  readonly scheduledEndControl = new FormControl('', { nonNullable: true });
  readonly continuityCategoryControl = new FormControl('', { nonNullable: true });
  readonly continuityReasonControl = new FormControl('', { nonNullable: true });
  private readonly queryValue = toSignal(this.queryControl.valueChanges, {
    initialValue: this.queryControl.value,
  });
  private readonly dispatchModeValue = toSignal(this.dispatchModeControl.valueChanges, {
    initialValue: this.dispatchModeControl.value,
  });
  private readonly linkedJobEntryIdValue = toSignal(this.linkedJobEntryIdControl.valueChanges, {
    initialValue: this.linkedJobEntryIdControl.value,
  });
  private readonly jobLabelValue = toSignal(this.jobLabelControl.valueChanges, {
    initialValue: this.jobLabelControl.value,
  });
  private readonly addressValue = toSignal(this.addressControl.valueChanges, {
    initialValue: this.addressControl.value,
  });
  private readonly scheduledStartValue = toSignal(this.scheduledStartControl.valueChanges, {
    initialValue: this.scheduledStartControl.value,
  });
  private readonly scheduledEndValue = toSignal(this.scheduledEndControl.valueChanges, {
    initialValue: this.scheduledEndControl.value,
  });
  private readonly continuityCategoryValue = toSignal(
    this.continuityCategoryControl.valueChanges,
    {
      initialValue: this.continuityCategoryControl.value,
    },
  );
  private readonly continuityReasonValue = toSignal(this.continuityReasonControl.valueChanges, {
    initialValue: this.continuityReasonControl.value,
  });
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
  readonly addressSuggestions = signal<readonly AddressSuggestion[]>([]);
  readonly showAddressSuggestions = signal(false);
  readonly addressLookupLoading = signal(false);
  readonly addressLookupMessage = signal<string | null>(null);
  readonly addressVerified = signal(false);
  private readonly addressLookupSub: Subscription;
  private readonly addressSyncSub: Subscription;
  private addressSelectionId: string | null = null;
  private verifiedAddressValue: string | null = null;
  private addressSessionToken = this.generateAddressSessionToken();
  private readonly addressSuggestionCache = new Map<string, AddressSuggestResponse>();
  private addressAutoFillInProgress = false;

  private readonly readinessSignal = signal<EmployeeStartNextJobReadiness[]>([]);
  private readonly historySignal = signal<EmployeeJobHistoryRecord[]>([]);
  private readonly loggedJobOptionsSignal = signal<EmployeeLoggedJobOption[]>([]);
  private readonly selectedEmployeeIdsSignal = signal<string[]>([]);
  private readonly selectedHistoryEntryIdsSignal = signal<string[]>([]);

  constructor() {
    this.addressSyncSub = this.addressControl.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe((value) => this.syncAddressVerificationState(value));
    this.addressLookupSub = this.addressControl.valueChanges
      .pipe(debounceTime(ADDRESS_LOOKUP_DEBOUNCE_MS), distinctUntilChanged())
      .subscribe((value) => {
        void this.handleAddressQuery(value);
      });
    this.syncAddressVerificationState(this.addressControl.value);
    this.setAnalyticsWindow('30d');
    this.refreshStartNowSchedule();
  }

  ngOnDestroy(): void {
    this.addressLookupSub.unsubscribe();
    this.addressSyncSub.unsubscribe();
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
  readonly activeLinkedJobEntryIds = computed(() => {
    const activeIds = new Set<string>();
    for (const entry of this.historySignal()) {
      if (!this.isRunActive(entry) || !entry.jobEntryId) {
        continue;
      }
      activeIds.add(entry.jobEntryId);
    }
    return activeIds;
  });
  readonly visibleLoggedJobOptions = computed(() => {
    const includeCompleted = this.showCompletedJobOptions();
    const selectedEntryId = this.linkedJobEntryIdValue().trim();
    const activeLinkedIds = this.activeLinkedJobEntryIds();
    return this.loggedJobOptions().filter((option) => {
      if (activeLinkedIds.has(option.entryId)) {
        return false;
      }
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
    const entryId = this.linkedJobEntryIdValue().trim();
    if (!entryId || entryId === MANUAL_JOB_MODE) {
      return null;
    }
    return this.loggedJobOptions().find((option) => option.entryId === entryId) ?? null;
  });
  readonly hasJobModeSelection = computed(() => {
    if (this.editingHistoryEntryId()) {
      return true;
    }
    const entryId = this.linkedJobEntryIdValue().trim();
    return Boolean(entryId);
  });
  readonly isManualJobSelection = computed(
    () => this.linkedJobEntryIdValue().trim() === MANUAL_JOB_MODE,
  );
  readonly hasLinkedJobSelection = computed(() => Boolean(this.selectedLinkedJob()));
  readonly isStartNowMode = computed(() => this.dispatchModeValue() === 'start_now');
  readonly isScheduleLaterMode = computed(() => this.dispatchModeValue() === 'schedule_later');
  readonly dispatchTimingLabel = computed(() =>
    this.isStartNowMode() ? 'Starts now' : 'Scheduled for later',
  );
  readonly dispatchTimingSummary = computed(() => {
    const start = this.scheduledStartValue();
    const end = this.scheduledEndValue();
    if (!start || !end) {
      return 'Set a linked job mode to establish timing.';
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return 'Set valid start and end values.';
    }
    const durationMinutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
    const durationText =
      durationMinutes % 60 === 0
        ? `${durationMinutes / 60}h`
        : `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`;
    return `${this.dispatchTimingLabel()}: ${startDate.toLocaleString()} -> ${endDate.toLocaleString()} (${durationText}).`;
  });
  readonly continuityCategoryOptions = continuityCategoryOptions;
  readonly requiresContinuityDetails = computed(
    () => this.selectedLinkedJob()?.status === 'completed',
  );
  readonly linkedScheduleReadOnly = computed(() => {
    return this.isStartNowMode();
  });
  readonly selectedEmployeeIds = computed(() => this.selectedEmployeeIdsSignal());
  readonly selectedHistoryEntryIds = computed(() => this.selectedHistoryEntryIdsSignal());

  readonly filteredReadiness = computed(() => {
    const query = normalizeText(this.queryValue());
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

  readonly ongoingRuns = computed<OngoingRunSnapshot[]>(() => {
    const history = this.historySignal();
    if (!history.length) {
      return [];
    }

    const nameLookup = new Map(
      this.readinessSnapshot().map((employee) => [employee.employeeId, employee.fullName]),
    );
    const linkedJobLookup = new Map(
      this.loggedJobOptions().map((option) => [option.entryId, option]),
    );
    const groupedRuns = new Map<string, EmployeeJobHistoryRecord[]>();
    for (const entry of history) {
      if (!this.isRunActive(entry)) {
        continue;
      }
      const runKey = entry.assignmentId?.trim() || entry.id;
      const existing = groupedRuns.get(runKey);
      if (existing) {
        existing.push(entry);
      } else {
        groupedRuns.set(runKey, [entry]);
      }
    }

    return [...groupedRuns.entries()]
      .map(([runKey, entries]) => {
        const sortedEntries = [...entries].sort((left, right) =>
          left.employeeId.localeCompare(right.employeeId),
        );
        const primary = sortedEntries[0];
        const linkedClientName = primary.jobEntryId
          ? (linkedJobLookup.get(primary.jobEntryId)?.clientName ?? null)
          : null;
        const hasClientPrefix =
          linkedClientName
            ? normalizeText(primary.siteLabel).startsWith(`${normalizeText(linkedClientName)} - `)
            : false;
        const displayJobLabel =
          linkedClientName && !hasClientPrefix
            ? `${linkedClientName} - ${primary.siteLabel}`
            : primary.siteLabel;
        const activeCrewNames = sortedEntries.map(
          (entry) => nameLookup.get(entry.employeeId) ?? 'Unknown employee',
        );
        const now = Date.now();
        const scheduledStartTimestamp = toTimestamp(primary.scheduledStart) ?? now;
        const scheduledEndTimestamp = toTimestamp(primary.scheduledEnd) ?? now;
        const state: OngoingRunState =
          now > scheduledEndTimestamp
            ? 'late'
            : now < scheduledStartTimestamp
              ? 'early_start'
              : 'on_schedule';

        return {
          runKey,
          primaryEntryId: primary.id,
          assignmentId: primary.assignmentId ?? null,
          displayJobLabel,
          address: primary.address,
          scheduledStart: primary.scheduledStart,
          scheduledEnd: primary.scheduledEnd,
          runStartedAt: primary.runStartedAt ?? primary.scheduledStart,
          activeCrewCount: activeCrewNames.length,
          activeCrewNames,
          state,
        };
      })
      .sort((left, right) => right.runStartedAt.localeCompare(left.runStartedAt));
  });

  private readonly selectedCrewHistoryAll = computed<SelectedCrewHistoryItem[]>(() => {
    const selectedIds = new Set(this.selectedEmployeeIds());
    if (!selectedIds.size) {
      return [];
    }
    const nameLookup = new Map(
      this.readinessSnapshot().map((employee) => [employee.employeeId, employee.fullName]),
    );
    const linkedJobLookup = new Map(
      this.loggedJobOptions().map((option) => [option.entryId, option]),
    );
    return this.historySignal()
      .filter((historyItem) => selectedIds.has(historyItem.employeeId))
      .map((historyItem) => {
        const linkedClientName = historyItem.jobEntryId
          ? (linkedJobLookup.get(historyItem.jobEntryId)?.clientName ?? null)
          : null;
        const hasClientPrefix =
          linkedClientName
            ? normalizeText(historyItem.siteLabel).startsWith(
                `${normalizeText(linkedClientName)} - `,
              )
            : false;
        const displayJobLabel =
          linkedClientName && !hasClientPrefix
            ? `${linkedClientName} - ${historyItem.siteLabel}`
            : historyItem.siteLabel;
        return {
          ...historyItem,
          employeeName: nameLookup.get(historyItem.employeeId) ?? 'Unknown employee',
          linkedClientName,
          displayJobLabel,
        };
      })
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
    const lifecycle = computeHistoryLifecycleSummary(history);
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
      completedOnTimeCount: lifecycle.completedOnTime,
      completedLateCount: lifecycle.completedLate,
      scheduledLateCount: lifecycle.scheduledLate,
      continuityCount: lifecycle.continuity,
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
    const startTimestamp = toTimestamp(this.scheduledStartValue());
    const endTimestamp = toTimestamp(this.scheduledEndValue());
    return this.selectedCrew().flatMap((employee) =>
      this.buildConflictsForEmployee(employee, startTimestamp, endTimestamp),
    );
  });

  readonly draftValidation = computed<AssignmentDraftValidation>(() => {
    const blockingReasons: string[] = [];
    if (!this.editingHistoryEntryId() && !this.hasJobModeSelection()) {
      blockingReasons.push('Select a linked job mode (linked client job or manual mode).');
    }
    if (!this.jobLabelValue().trim()) {
      blockingReasons.push('Job label is required.');
    }
    if (!this.addressValue().trim()) {
      blockingReasons.push('Job address is required.');
    }
    if (
      this.enforceVerifiedAddress &&
      this.addressValue().trim().length > 0 &&
      !this.addressVerified()
    ) {
      blockingReasons.push('Select a verified address from suggestions.');
    }
    const startTimestamp = toTimestamp(this.scheduledStartValue());
    const endTimestamp = toTimestamp(this.scheduledEndValue());
    if (!startTimestamp || !endTimestamp) {
      blockingReasons.push('Scheduled start and end are required.');
    } else if (endTimestamp <= startTimestamp) {
      blockingReasons.push('Scheduled end must be after scheduled start.');
    }
    if (!this.selectedEmployeeIds().length) {
      blockingReasons.push('Select at least one employee for the crew.');
    }
    if (this.requiresContinuityDetails()) {
      if (!this.continuityCategoryValue().trim()) {
        blockingReasons.push(
          'Continuity category is required when using a completed linked job.',
        );
      }
      if (!this.continuityReasonValue().trim()) {
        blockingReasons.push(
          'Continuity reason is required when using a completed linked job.',
        );
      }
    }
    if (this.selectedCrewConflicts().length) {
      blockingReasons.push('Resolve crew conflicts before creating the assignment draft.');
    }
    const selectedLinkedJob = this.selectedLinkedJob();
    if (
      selectedLinkedJob &&
      this.activeLinkedJobEntryIds().has(selectedLinkedJob.entryId)
    ) {
      blockingReasons.push('Selected linked job is already running.');
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
      await this.reconcileBoardState();
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

  setDispatchMode(mode: StartNextJobDispatchMode, now = new Date()): void {
    if (this.dispatchModeControl.value === mode) {
      return;
    }
    this.dispatchModeControl.setValue(mode);
    if (this.hasJobModeSelection()) {
      this.applyLinkedJobSelection(now);
      return;
    }
    this.refreshStartNowSchedule(now);
  }

  refreshStartNowSchedule(now = new Date()): void {
    if (!this.isStartNowMode()) {
      return;
    }
    const selectedLinkedJob = this.selectedLinkedJob();
    const duration = this.resolveScheduleDurationMs(selectedLinkedJob);
    this.applyScheduleWindow(now, duration);
  }

  applyLinkedJobSelection(now = new Date()): void {
    this.clearSaveFeedback();
    const selectedJobId = this.linkedJobEntryIdControl.value.trim();
    if (!selectedJobId || selectedJobId === MANUAL_JOB_MODE) {
      this.refreshStartNowSchedule(now);
      this.clearContinuityInputs();
      this.syncAddressVerificationState(this.addressControl.value);
      return;
    }
    const selectedJob = this.selectedLinkedJob();
    if (!selectedJob) {
      this.refreshStartNowSchedule(now);
      this.clearContinuityInputs();
      this.syncAddressVerificationState(this.addressControl.value);
      return;
    }
    this.jobLabelControl.setValue(this.toLinkedJobDisplayLabel(selectedJob));
    this.addressAutoFillInProgress = true;
    this.addressControl.setValue(selectedJob.address);
    this.addressAutoFillInProgress = false;
    this.markAddressVerified(selectedJob.address, null);
    this.showAddressSuggestions.set(false);
    this.addressSuggestions.set([]);
    this.addressLookupMessage.set('Linked job address loaded and locked.');
    if (this.isStartNowMode()) {
      this.applyScheduleWindow(now, this.resolveScheduleDurationMs(selectedJob));
    } else if (selectedJob.status === 'late') {
      const startTimestamp = now.getTime();
      const originalStart = toTimestamp(selectedJob.scheduledStart);
      const originalEnd = toTimestamp(selectedJob.scheduledEnd);
      const duration =
        originalStart && originalEnd && originalEnd > originalStart
          ? originalEnd - originalStart
          : DEFAULT_SCHEDULE_DURATION_MS;
      this.applyScheduleWindow(new Date(startTimestamp), duration);
    } else {
      this.scheduledStartControl.setValue(toDateTimeLocal(selectedJob.scheduledStart));
      this.scheduledEndControl.setValue(toDateTimeLocal(selectedJob.scheduledEnd));
    }
    if (selectedJob.status !== 'completed') {
      this.clearContinuityInputs();
    }
  }

  toggleCompletedJobOptions(): void {
    this.showCompletedJobOptions.update((current) => !current);
  }

  handleAddressFocus(): void {
    const query = this.addressControl.value.trim();
    if (
      this.hasLinkedJobSelection() ||
      query.length < 3 ||
      this.addressSuggestions().length === 0
    ) {
      return;
    }
    this.showAddressSuggestions.set(true);
  }

  handleAddressBlur(): void {
    setTimeout(() => {
      this.showAddressSuggestions.set(false);
    }, 120);
  }

  async selectAddressSuggestion(suggestion: AddressSuggestion): Promise<void> {
    if (this.hasLinkedJobSelection()) {
      return;
    }
    this.addressAutoFillInProgress = true;
    this.addressControl.setValue(suggestion.label);
    this.addressControl.markAsTouched();
    this.addressAutoFillInProgress = false;

    this.addressLookupLoading.set(true);
    this.addressLookupMessage.set('Validating selected address...');
    this.showAddressSuggestions.set(false);
    this.addressSuggestions.set([]);
    this.addressSelectionId = suggestion.id;

    try {
      const result = await this.addressLookup.validate(suggestion.id, this.addressSessionToken);
      if (!result.verified) {
        this.addressVerified.set(false);
        this.addressSelectionId = null;
        this.verifiedAddressValue = null;
        this.addressLookupMessage.set(
          result.message ?? 'Select a valid address from suggestions.',
        );
        return;
      }

      const normalizedAddress = result.normalizedAddress?.formattedAddress?.trim();
      if (normalizedAddress && normalizedAddress !== this.addressControl.value) {
        this.addressAutoFillInProgress = true;
        this.addressControl.setValue(normalizedAddress);
        this.addressAutoFillInProgress = false;
      }
      this.markAddressVerified(this.addressControl.value, suggestion.id);
      this.addressLookupMessage.set('Address verified.');

      if (result.usage.thresholds.warn90Reached) {
        this.addressLookupMessage.set(
          'Address verified. Warning: monthly address API quota is above 90%.',
        );
      } else if (result.usage.thresholds.warn75Reached) {
        this.addressLookupMessage.set(
          'Address verified. Monthly address API quota is above 75%.',
        );
      }
    } catch {
      this.addressVerified.set(false);
      this.addressSelectionId = null;
      this.verifiedAddressValue = null;
      this.addressLookupMessage.set('Unable to validate address right now. Try again.');
    } finally {
      this.addressSessionToken = this.generateAddressSessionToken();
      this.addressSuggestionCache.clear();
      this.addressLookupLoading.set(false);
    }
  }

  isRunActive(entry: Pick<EmployeeJobHistoryRecord, 'status' | 'runStartedAt' | 'runEndedAt'>): boolean {
    if (entry.status !== 'scheduled') {
      return false;
    }
    return Boolean(entry.runStartedAt && !entry.runEndedAt);
  }

  canStartHistoryRun(entry: Pick<EmployeeJobHistoryRecord, 'status' | 'runStartedAt' | 'runEndedAt'>): boolean {
    return entry.status === 'scheduled' && !this.isRunActive(entry);
  }

  canEndHistoryRun(entry: Pick<EmployeeJobHistoryRecord, 'status' | 'runStartedAt' | 'runEndedAt'>): boolean {
    return this.isRunActive(entry);
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

  dismissSaveFeedback(): void {
    this.clearSaveFeedback();
  }

  async submitAssignment(actorRole: EmployeeOperatorRole = 'owner'): Promise<boolean> {
    try {
      await this.reconcileBoardState();
    } catch {
      this.saveState.set('error');
      this.saveMessage.set('Unable to refresh assignment data right now. Try again.');
      return false;
    }

    this.refreshStartNowSchedule();
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
      let runStarted = false;
      if (this.isStartNowMode() && result.createdHistory.length) {
        try {
          const lifecycle = await this.employeesData.startAssignmentRun(
            result.createdHistory[0]!.id,
            actorRole,
          );
          this.applyHistoryUpserts(lifecycle.updatedHistory);
          runStarted = true;
        } catch (error) {
          const reason = this.resolveMutationErrorMessage(
            error,
            'Unable to start the run automatically.',
          );
          this.saveState.set('success');
          this.saveMessage.set(
            `Assignment saved for ${result.createdHistory.length} crew member(s), but live start failed: ${reason}`,
          );
          this.resetDraftAfterSave();
          await this.reconcileAfterMutation(
            'Assignment saved, but board refresh failed. Click Retry if values look stale.',
          );
          return true;
        }
      }
      this.saveState.set('success');
      if (runStarted) {
        this.saveMessage.set(
          `Assignment started live for ${result.createdHistory.length} crew member(s).`,
        );
      } else if (this.isStartNowMode()) {
          runStarted = false;
        this.saveMessage.set(
          `Assignment saved for ${result.createdHistory.length} crew member(s). Start run from Scheduled history.`,
        );
      } else {
        this.saveMessage.set(`Assignment saved for ${result.createdHistory.length} crew member(s).`);
      }
      this.resetDraftAfterSave();
      await this.reconcileAfterMutation(
        'Assignment saved, but board refresh failed. Click Retry if values look stale.',
      );
      return true;
    } catch (error) {
      this.saveState.set('error');
      this.saveMessage.set(
        this.resolveMutationErrorMessage(error, 'Unable to save assignment right now.'),
      );
      return false;
    }
  }

  beginHistoryEdit(entry: SelectedCrewHistoryItem): void {
    if (entry.status !== 'scheduled' || this.isRunActive(entry)) {
      return;
    }
    this.dispatchModeControl.setValue('schedule_later');
    this.editingHistoryEntryId.set(entry.id);
    this.linkedJobEntryIdControl.setValue(entry.jobEntryId ?? MANUAL_JOB_MODE);
    this.jobLabelControl.setValue(entry.siteLabel);
    this.addressAutoFillInProgress = true;
    this.addressControl.setValue(entry.address);
    this.addressAutoFillInProgress = false;
    this.markAddressVerified(entry.address, null);
    this.showAddressSuggestions.set(false);
    this.addressSuggestions.set([]);
    this.addressLookupMessage.set(null);
    this.scheduledStartControl.setValue(toDateTimeLocal(entry.scheduledStart));
    this.scheduledEndControl.setValue(toDateTimeLocal(entry.scheduledEnd));
    this.clearContinuityInputs();
    this.saveState.set('idle');
    this.saveMessage.set('');
  }

  cancelHistoryEdit(): void {
    this.editingHistoryEntryId.set(null);
    this.showAddressSuggestions.set(false);
    this.addressSuggestions.set([]);
    this.addressLookupMessage.set(null);
    this.syncAddressVerificationState(this.addressControl.value);
    this.clearSaveFeedback();
  }

  isEditingHistoryEntry(entryId: string): boolean {
    return this.editingHistoryEntryId() === entryId;
  }

  canSubmitHistoryEdit(): boolean {
    if (!this.editingHistoryEntryId()) {
      return false;
    }
    const editingEntry = this.historySignal().find(
      (entry) => entry.id === this.editingHistoryEntryId(),
    );
    if (editingEntry && this.isRunActive(editingEntry)) {
      return false;
    }
    if (!this.jobLabelControl.value.trim() || !this.addressControl.value.trim()) {
      return false;
    }
    if (this.enforceVerifiedAddress && !this.addressVerified()) {
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
    const nextSiteLabel = this.resolvePersistedJobLabel();
    const optimisticEntry: EmployeeJobHistoryRecord = {
      ...existing,
      siteLabel: nextSiteLabel,
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
          siteLabel: nextSiteLabel,
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
      await this.reconcileAfterMutation(
        'Schedule updated, but board refresh failed. Click Retry if values look stale.',
      );
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
      await this.reconcileAfterMutation(
        'Cancellation saved, but board refresh failed. Click Retry if values look stale.',
      );
      return true;
    } catch {
      this.restoreBoardSnapshot(snapshot);
      this.saveState.set('error');
      this.saveMessage.set('Unable to cancel the scheduled assignment right now.');
      return false;
    }
  }

  async startHistoryRun(
    entryId: string,
    actorRole: EmployeeOperatorRole = 'owner',
  ): Promise<boolean> {
    const existing = this.historySignal().find((entry) => entry.id === entryId);
    if (!existing) {
      this.saveState.set('error');
      this.saveMessage.set('Unable to find this scheduled assignment anymore.');
      return false;
    }
    if (!this.canStartHistoryRun(existing)) {
      this.saveState.set('error');
      this.saveMessage.set('Run is already active or cannot be started.');
      return false;
    }

    const nowIso = new Date().toISOString();
    const snapshot = this.captureBoardSnapshot();
    this.saveState.set('saving');
    this.saveMessage.set('Starting run...');
    this.applyHistoryUpserts([
      {
        ...existing,
        runStartedAt: nowIso,
        runEndedAt: null,
        runClockOutReason: null,
      },
    ]);
    try {
      const lifecycle = await this.employeesData.startAssignmentRun(entryId, actorRole);
      this.applyHistoryUpserts(lifecycle.updatedHistory);
      this.saveState.set('success');
      this.saveMessage.set('Run started. Crew clock-in is now active.');
      await this.reconcileAfterMutation(
        'Run started, but board refresh failed. Click Retry if values look stale.',
      );
      return true;
    } catch {
      this.restoreBoardSnapshot(snapshot);
      this.saveState.set('error');
      this.saveMessage.set('Unable to start this run right now.');
      return false;
    }
  }

  async endHistoryRun(
    entryId: string,
    actorRole: EmployeeOperatorRole = 'owner',
    completionNote: string | null = null,
  ): Promise<boolean> {
    const existing = this.historySignal().find((entry) => entry.id === entryId);
    if (!existing) {
      this.saveState.set('error');
      this.saveMessage.set('Unable to find this scheduled assignment anymore.');
      return false;
    }
    if (!this.canEndHistoryRun(existing)) {
      this.saveState.set('error');
      this.saveMessage.set('Run is not active yet.');
      return false;
    }

    const snapshot = this.captureBoardSnapshot();
    const nowIso = new Date().toISOString();
    const startIso = existing.runStartedAt ?? existing.scheduledStart;
    const startedTimestamp = toTimestamp(startIso) ?? Date.now();
    const endedTimestamp = toTimestamp(nowIso) ?? Date.now();
    const durationHours = Math.max(
      0.25,
      Math.round(((endedTimestamp - startedTimestamp) / 3_600_000) * 4) / 4,
    );
    this.saveState.set('saving');
    this.saveMessage.set('Ending run and clocking out crew...');
    const normalizedCompletionNote = completionNote?.trim() || null;
    this.removeSelectedHistoryIds([entryId]);
    this.applyHistoryUpserts([
      {
        ...existing,
        status: 'completed',
        runEndedAt: nowIso,
        hoursWorked: durationHours,
        runClockOutReason: normalizedCompletionNote,
      },
    ]);
    try {
      const lifecycle = await this.employeesData.endAssignmentRun(
        entryId,
        normalizedCompletionNote ? { completionNote: normalizedCompletionNote } : {},
        actorRole,
      );
      this.applyHistoryUpserts(lifecycle.updatedHistory);
      this.saveState.set('success');
      this.saveMessage.set('Run ended. Remaining crew members were clocked out.');
      await this.reconcileAfterMutation(
        'Run ended, but board refresh failed. Click Retry if values look stale.',
      );
      return true;
    } catch {
      this.restoreBoardSnapshot(snapshot);
      this.saveState.set('error');
      this.saveMessage.set('Unable to end this run right now.');
      return false;
    }
  }

  async clockOutHistoryMember(
    entryId: string,
    reason: string | null = null,
    actorRole: EmployeeOperatorRole = 'owner',
  ): Promise<boolean> {
    const existing = this.historySignal().find((entry) => entry.id === entryId);
    if (!existing) {
      this.saveState.set('error');
      this.saveMessage.set('Unable to find this active run member anymore.');
      return false;
    }
    if (!this.canEndHistoryRun(existing)) {
      this.saveState.set('error');
      this.saveMessage.set('Only active run members can be clocked out.');
      return false;
    }

    const normalizedReason = reason?.trim() || null;
    const snapshot = this.captureBoardSnapshot();
    const nowIso = new Date().toISOString();
    const startIso = existing.runStartedAt ?? existing.scheduledStart;
    const startedTimestamp = toTimestamp(startIso) ?? Date.now();
    const endedTimestamp = toTimestamp(nowIso) ?? Date.now();
    const durationHours = Math.max(
      0.25,
      Math.round(((endedTimestamp - startedTimestamp) / 3_600_000) * 4) / 4,
    );
    this.saveState.set('saving');
    this.saveMessage.set('Clocking out crew member...');
    this.removeSelectedHistoryIds([entryId]);
    this.applyHistoryUpserts([
      {
        ...existing,
        status: 'completed',
        runEndedAt: nowIso,
        hoursWorked: durationHours,
        runClockOutReason: normalizedReason,
      },
    ]);
    try {
      const lifecycle = await this.employeesData.clockOutAssignmentMember(
        entryId,
        normalizedReason ? { reason: normalizedReason } : {},
        actorRole,
      );
      this.applyHistoryUpserts(lifecycle.updatedHistory);
      this.saveState.set('success');
      if (lifecycle.runEndedAt) {
        this.saveMessage.set(
          'Crew member clocked out. No active crew remains on this run.',
        );
      } else if (normalizedReason) {
        this.saveMessage.set('Crew member clocked out with note.');
      } else {
        this.saveMessage.set('Crew member clocked out.');
      }
      await this.reconcileAfterMutation(
        'Clock-out saved, but board refresh failed. Click Retry if values look stale.',
      );
      return true;
    } catch {
      this.restoreBoardSnapshot(snapshot);
      this.saveState.set('error');
      this.saveMessage.set('Unable to clock out this crew member right now.');
      return false;
    }
  }

  resolveReassignTarget(entry: SelectedCrewHistoryItem): {
    employeeId: string;
    fullName: string;
  } | null {
    if (entry.status !== 'scheduled' || this.isRunActive(entry)) {
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
      await this.reconcileAfterMutation(
        'Reassignment saved, but board refresh failed. Click Retry if values look stale.',
      );
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
      await this.reconcileAfterMutation(
        'Completion saved, but board refresh failed. Click Retry if values look stale.',
      );
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
      await this.reconcileAfterMutation(
        'Bulk completion saved, but board refresh failed. Click Retry if values look stale.',
      );
      return true;
    }

    this.restoreHistoryEntries(snapshot.history, failedIds);
    this.selectedHistoryEntryIdsSignal.set(failedIds);
    this.saveState.set('error');
    this.saveMessage.set(
      `Completed ${succeededRecords.length} of ${entries.length} scheduled assignments. Retry the remaining ${failedCount}.`,
    );
    await this.reconcileAfterMutation(
      'Partial bulk completion applied, but board refresh failed. Click Retry if values look stale.',
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
      await this.reconcileAfterMutation(
        'Bulk cancellation saved, but board refresh failed. Click Retry if values look stale.',
      );
      return true;
    }

    this.restoreHistoryEntries(snapshot.history, failedIds);
    this.selectedHistoryEntryIdsSignal.set(failedIds);
    this.saveState.set('error');
    this.saveMessage.set(
      `Cancelled ${succeededRecords.length} of ${entries.length} scheduled assignments. Retry the remaining ${failedCount}.`,
    );
    await this.reconcileAfterMutation(
      'Partial bulk cancellation applied, but board refresh failed. Click Retry if values look stale.',
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
      `${escapeCsvCell('Completed on time')},${escapeCsvCell(analytics.completedOnTimeCount)}`,
      `${escapeCsvCell('Completed late')},${escapeCsvCell(analytics.completedLateCount)}`,
      `${escapeCsvCell('Scheduled late')},${escapeCsvCell(analytics.scheduledLateCount)}`,
      `${escapeCsvCell('Continuity segments')},${escapeCsvCell(analytics.continuityCount)}`,
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
    const activeRun = this.historySignal().find(
      (entry) => entry.employeeId === employee.employeeId && this.isRunActive(entry),
    );
    if (activeRun) {
      conflicts.push({
        employeeId: employee.employeeId,
        employeeName: employee.fullName,
        reason: `Active on "${activeRun.siteLabel}" until ended.`,
      });
      return conflicts;
    }
    if (!startTimestamp || !endTimestamp) {
      return conflicts;
    }

    const overlappingScheduled = this.historySignal().filter(
      (entry) =>
        entry.employeeId === employee.employeeId &&
        entry.status === 'scheduled' &&
        overlapsRange(
          startTimestamp,
          endTimestamp,
          toTimestamp(entry.scheduledStart) ?? 0,
          toTimestamp(entry.scheduledEnd) ?? 0,
        ),
    );
    for (const entry of overlappingScheduled) {
      conflicts.push({
        employeeId: employee.employeeId,
        employeeName: employee.fullName,
        reason: `Overlaps "${entry.siteLabel}".`,
      });
    }
    return conflicts;
  }

  private resolveScheduleDurationMs(
    selectedJob: EmployeeLoggedJobOption | null,
  ): number {
    const linkedJobDuration = this.getLinkedJobDurationMs(selectedJob);
    if (linkedJobDuration !== null) {
      return linkedJobDuration;
    }
    const startTimestamp = toTimestamp(this.scheduledStartControl.value);
    const endTimestamp = toTimestamp(this.scheduledEndControl.value);
    if (startTimestamp && endTimestamp && endTimestamp > startTimestamp) {
      return endTimestamp - startTimestamp;
    }
    return DEFAULT_SCHEDULE_DURATION_MS;
  }

  private getLinkedJobDurationMs(
    selectedJob: EmployeeLoggedJobOption | null,
  ): number | null {
    if (!selectedJob) {
      return null;
    }
    const startTimestamp = toTimestamp(selectedJob.scheduledStart);
    const endTimestamp = toTimestamp(selectedJob.scheduledEnd);
    if (!startTimestamp || !endTimestamp || endTimestamp <= startTimestamp) {
      return null;
    }
    return endTimestamp - startTimestamp;
  }

  private applyScheduleWindow(now: Date, durationMs: number): void {
    const safeDuration = durationMs > 0 ? durationMs : DEFAULT_SCHEDULE_DURATION_MS;
    const startIso = now.toISOString();
    const endIso = new Date(now.getTime() + safeDuration).toISOString();
    this.scheduledStartControl.setValue(toDateTimeLocal(startIso));
    this.scheduledEndControl.setValue(toDateTimeLocal(endIso));
  }

  private buildAssignmentPayload(): EmployeeStartNextJobAssignmentPayload {
    const linkedEntryId = this.linkedJobEntryIdControl.value.trim();
    const continuityCategory = this.resolveContinuityCategory(
      this.continuityCategoryControl.value.trim(),
    );
    const continuityReason = this.continuityReasonControl.value.trim();
    const includeContinuity = this.requiresContinuityDetails();
    return {
      jobLabel: this.resolvePersistedJobLabel(),
      address: this.addressControl.value.trim(),
      scheduledStart: toIsoDateTime(this.scheduledStartControl.value),
      scheduledEnd: toIsoDateTime(this.scheduledEndControl.value),
      employeeIds: this.selectedEmployeeIds(),
      jobEntryId: linkedEntryId && linkedEntryId !== MANUAL_JOB_MODE ? linkedEntryId : null,
      continuityCategory: includeContinuity ? continuityCategory : null,
      continuityReason: includeContinuity ? continuityReason : null,
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

  private toLinkedJobDisplayLabel(selectedJob: EmployeeLoggedJobOption): string {
    return `${selectedJob.clientName} - ${selectedJob.siteLabel}`;
  }

  private resolvePersistedJobLabel(): string {
    return this.selectedLinkedJob()?.siteLabel ?? this.jobLabelControl.value.trim();
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
    const nowIso = new Date().toISOString();
    const nowTimestamp = Date.now();
    return [...this.readinessSignal()]
      .map((record) => {
        const employeeHistory = history.filter((entry) => entry.employeeId === record.employeeId);
        const scheduledEntries = employeeHistory
          .filter((entry) => entry.status === 'scheduled')
          .sort((left, right) => left.scheduledStart.localeCompare(right.scheduledStart));
        const activeRunEntries = scheduledEntries.filter((entry) => this.isRunActive(entry));
        const upcomingEntries = scheduledEntries.filter(
          (entry) =>
            this.isRunActive(entry) || ((toTimestamp(entry.scheduledEnd) ?? 0) > nowTimestamp),
        );
        const activeEntries = activeRunEntries.length
          ? activeRunEntries
          : upcomingEntries.filter(
              (entry) => (toTimestamp(entry.scheduledStart) ?? 0) <= nowTimestamp,
            );
        const completedEntries = employeeHistory
          .filter((entry) => entry.status === 'completed')
          .sort((left, right) => right.scheduledEnd.localeCompare(left.scheduledEnd));

        const nextScheduled = upcomingEntries[0];
        const hasConflict = upcomingEntries.some((entry, index) => {
          const nextEntry = upcomingEntries[index + 1];
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
            : activeEntries.length
              ? 'scheduled'
              : 'available';

        return {
          ...record,
          readinessState,
          scheduledJobsCount: upcomingEntries.length,
          completedJobsCount: completedEntries.length,
          scheduledHours: upcomingEntries.reduce((sum, entry) => sum + entry.hoursWorked, 0),
          completedHours: completedEntries.reduce((sum, entry) => sum + entry.hoursWorked, 0),
          nextScheduledStart: nextScheduled?.scheduledStart ?? null,
          nextScheduledEnd: nextScheduled?.scheduledEnd ?? null,
          nextAvailableAt:
            record.status === 'inactive'
              ? null
              : activeEntries.length
                ? this.computeNextAvailabilityFromEntries(activeEntries)
                : nowIso,
          lastCompletedAt: lastCompleted?.scheduledEnd ?? null,
          lastCompletedSite: lastCompleted?.siteLabel ?? null,
          hasScheduleConflict: hasConflict,
          upcomingWindows: upcomingEntries.map((entry) => ({
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

  private computeNextAvailabilityFromEntries(
    entries: readonly EmployeeJobHistoryRecord[],
  ): string {
    const fallbackTimestamp = Date.now();
    const latestEndTimestamp = entries.reduce((latest, entry) => {
      const nextEnd = toTimestamp(entry.scheduledEnd) ?? 0;
      return Math.max(latest, nextEnd);
    }, 0);
    const resolvedTimestamp = latestEndTimestamp
      ? Math.max(latestEndTimestamp, fallbackTimestamp)
      : fallbackTimestamp;
    return new Date(resolvedTimestamp).toISOString();
  }

  private async handleAddressQuery(value: string): Promise<void> {
    if (this.hasLinkedJobSelection()) {
      this.showAddressSuggestions.set(false);
      this.addressSuggestions.set([]);
      return;
    }
    const query = value.trim();
    if (query.length < 3) {
      this.addressSuggestions.set([]);
      this.showAddressSuggestions.set(false);
      if (!query.length) {
        this.addressLookupMessage.set(null);
      }
      return;
    }

    if (this.addressSelectionId && query === this.addressControl.value) {
      return;
    }

    const cacheKey = query.toLowerCase();
    const cached = this.addressSuggestionCache.get(cacheKey);
    if (cached) {
      this.applyAddressSuggestResult(cached);
      return;
    }

    this.addressLookupLoading.set(true);
    try {
      const result = await this.addressLookup.suggest(query, this.addressSessionToken);
      this.addressSuggestionCache.set(cacheKey, result);
      this.applyAddressSuggestResult(result);
    } catch {
      this.addressSuggestions.set([]);
      this.showAddressSuggestions.set(false);
      this.addressLookupMessage.set('Unable to search addresses right now.');
    } finally {
      this.addressLookupLoading.set(false);
    }
  }

  private applyAddressSuggestResult(result: AddressSuggestResponse): void {
    this.addressSuggestions.set(result.suggestions);
    this.showAddressSuggestions.set(result.status === 'ok' && result.suggestions.length > 0);

    if (result.usage.thresholds.hardStopReached) {
      this.addressLookupMessage.set(
        'Monthly address search cap reached. Search is paused until next month.',
      );
      this.showAddressSuggestions.set(false);
      return;
    }
    if (result.status !== 'ok') {
      this.addressLookupMessage.set(result.message ?? 'Address search is unavailable right now.');
      if (result.status === 'quota_reached') {
        this.showAddressSuggestions.set(false);
      }
      return;
    }
    if (!result.suggestions.length) {
      this.addressLookupMessage.set('No matching addresses found.');
      return;
    }
    if (result.usage.thresholds.warn90Reached) {
      this.addressLookupMessage.set(
        'Address API usage is above 90% this month. Keep searches focused.',
      );
      return;
    }
    if (result.usage.thresholds.warn75Reached) {
      this.addressLookupMessage.set('Address API usage is above 75% this month.');
      return;
    }
    this.addressLookupMessage.set(null);
  }

  private syncAddressVerificationState(value: string): void {
    if (!this.enforceVerifiedAddress) {
      this.addressVerified.set(value.trim().length > 0);
      return;
    }
    if (this.addressAutoFillInProgress) {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed.length) {
      this.addressVerified.set(false);
      this.addressSelectionId = null;
      this.verifiedAddressValue = null;
      this.addressSessionToken = this.generateAddressSessionToken();
      this.addressSuggestionCache.clear();
      this.addressLookupMessage.set(null);
      return;
    }
    const isStillVerifiedSelection =
      this.addressSelectionId !== null &&
      this.addressVerified() &&
      this.verifiedAddressValue === trimmed &&
      !this.addressLookupLoading();
    if (isStillVerifiedSelection) {
      return;
    }
    this.addressVerified.set(false);
    this.addressSelectionId = null;
    this.verifiedAddressValue = null;
    if (!this.addressLookupLoading()) {
      this.addressLookupMessage.set('Select a suggested address to continue.');
    }
  }

  private markAddressVerified(address: string, selectionId: string | null): void {
    const trimmed = address.trim();
    this.addressVerified.set(trimmed.length > 0);
    this.addressSelectionId = selectionId;
    this.verifiedAddressValue = trimmed.length > 0 ? trimmed : null;
  }

  private generateAddressSessionToken(): string {
    return `addr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private resetDraftAfterSave(): void {
    this.selectedEmployeeIdsSignal.set([]);
    this.selectedHistoryEntryIdsSignal.set([]);
    this.dispatchModeControl.setValue('start_now');
    this.queryControl.setValue('');
    this.linkedJobEntryIdControl.setValue('');
    this.jobLabelControl.setValue('');
    this.addressControl.setValue('');
    this.showAddressSuggestions.set(false);
    this.addressSuggestions.set([]);
    this.addressLookupMessage.set(null);
    this.addressSelectionId = null;
    this.verifiedAddressValue = null;
    this.addressSessionToken = this.generateAddressSessionToken();
    this.addressSuggestionCache.clear();
    this.refreshStartNowSchedule();
    this.clearContinuityInputs();
  }

  private clearContinuityInputs(): void {
    this.continuityCategoryControl.setValue('');
    this.continuityReasonControl.setValue('');
  }

  private resolveContinuityCategory(value: string): EmployeeContinuityCategory | null {
    if (!value) {
      return null;
    }
    const matchingOption = continuityCategoryOptions.find((option) => option.value === value);
    return matchingOption?.value ?? null;
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

  private async reconcileBoardState(): Promise<void> {
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
        this.linkedJobEntryIdControl.setValue('');
      }
    }
  }

  private async reconcileAfterMutation(refreshWarning: string): Promise<void> {
    try {
      await this.reconcileBoardState();
    } catch {
      if (this.saveState() === 'success') {
        this.saveState.set('error');
      }
      this.saveMessage.set(refreshWarning);
    }
  }

  private resolveMutationErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const payload = error.error as
        | string
        | { message?: string | string[]; error?: string }
        | null
        | undefined;
      if (typeof payload === 'string' && payload.trim()) {
        return payload.trim();
      }
      if (payload && typeof payload === 'object') {
        if (Array.isArray(payload.message) && payload.message.length) {
          return payload.message.join(' ');
        }
        if (typeof payload.message === 'string' && payload.message.trim()) {
          return payload.message.trim();
        }
        if (typeof payload.error === 'string' && payload.error.trim()) {
          return payload.error.trim();
        }
      }
      if (typeof error.message === 'string' && error.message.trim()) {
        return error.message.trim();
      }
      return fallback;
    }
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }
    return fallback;
  }
}
