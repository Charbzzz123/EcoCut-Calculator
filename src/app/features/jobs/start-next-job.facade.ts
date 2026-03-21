import { FormControl } from '@angular/forms';
import { computed, inject, Injectable, signal } from '@angular/core';
import { EmployeesDataService } from '../employees/employees-data.service.js';
import type {
  EmployeeJobHistoryRecord,
  EmployeeOperatorRole,
  EmployeeStartNextJobAssignmentPayload,
  EmployeeStartNextJobReadiness,
} from '../employees/employees.types.js';
import type {
  AssignmentDraftValidation,
  CrewConflict,
  ReadinessPill,
  SelectedCrewHistoryItem,
  StartNextJobLoadState,
  StartNextJobSaveState,
} from './start-next-job.types.js';

const normalizeText = (value: string): string => value.trim().toLowerCase();
const toTimestamp = (value: string): number | null => {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};
const overlapsRange = (
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean => startA < endB && endA > startB;
const toIsoDateTime = (value: string): string => new Date(value).toISOString();
const toDateTimeLocal = (value: string): string => {
  const date = new Date(value);
  const pad = (segment: number): string => segment.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

@Injectable()
export class StartNextJobFacade {
  private readonly employeesData = inject(EmployeesDataService);

  readonly headingId = 'start-next-job-heading';

  readonly queryControl = new FormControl('', { nonNullable: true });
  readonly jobLabelControl = new FormControl('', { nonNullable: true });
  readonly addressControl = new FormControl('', { nonNullable: true });
  readonly scheduledStartControl = new FormControl('', { nonNullable: true });
  readonly scheduledEndControl = new FormControl('', { nonNullable: true });

  readonly loadState = signal<StartNextJobLoadState>('loading');
  readonly errorMessage = signal('');
  readonly saveState = signal<StartNextJobSaveState>('idle');
  readonly saveMessage = signal('');
  readonly editingHistoryEntryId = signal<string | null>(null);

  private readonly readinessSignal = signal<EmployeeStartNextJobReadiness[]>([]);
  private readonly historySignal = signal<EmployeeJobHistoryRecord[]>([]);
  private readonly selectedEmployeeIdsSignal = signal<string[]>([]);
  private readonly selectedHistoryEntryIdsSignal = signal<string[]>([]);

  readonly readinessSnapshot = computed(() => this.readinessSignal());
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
    const lookup = new Map(this.readinessSnapshot().map((employee) => [employee.employeeId, employee]));
    return this.selectedEmployeeIds()
      .map((employeeId) => lookup.get(employeeId))
      .filter((employee): employee is EmployeeStartNextJobReadiness => Boolean(employee));
  });

  readonly selectedCrewHistory = computed<SelectedCrewHistoryItem[]>(() => {
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
      .sort((left, right) => right.scheduledStart.localeCompare(left.scheduledStart))
      .slice(0, 12);
  });

  readonly scheduledHistoryEntries = computed<SelectedCrewHistoryItem[]>(() =>
    this.selectedCrewHistory().filter((entry) => entry.status === 'scheduled'),
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

  readonly selectedCrewConflicts = computed<CrewConflict[]>(() => {
    const startTimestamp = toTimestamp(this.scheduledStartControl.value);
    const endTimestamp = toTimestamp(this.scheduledEndControl.value);
    return this.selectedCrew().flatMap((employee) =>
      this.buildConflictsForEmployee(employee, startTimestamp, endTimestamp),
    );
  });

  readonly draftValidation = computed<AssignmentDraftValidation>(() => {
    const blockingReasons: string[] = [];
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
      const [readiness, history] = await Promise.all([
        this.employeesData.listStartNextJobReadiness(),
        this.employeesData.listJobHistoryEntries(),
      ]);
      const sortedReadiness = [...readiness].sort((left, right) =>
        left.fullName.localeCompare(right.fullName),
      );
      this.readinessSignal.set(sortedReadiness);
      this.historySignal.set(history);
      const allowedIds = new Set(sortedReadiness.map((employee) => employee.employeeId));
      this.selectedEmployeeIdsSignal.update((selectedIds) =>
        selectedIds.filter((employeeId) => allowedIds.has(employeeId)),
      );
      const allowedHistoryIds = new Set(
        history.filter((entry) => entry.status === 'scheduled').map((entry) => entry.id),
      );
      this.selectedHistoryEntryIdsSignal.update((selectedIds) =>
        selectedIds.filter((entryId) => allowedHistoryIds.has(entryId)),
      );
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
      this.saveState.set('success');
      this.saveMessage.set(
        `Assignment saved for ${result.createdHistory.length} crew member(s).`,
      );
      this.resetDraftAfterSave();
      await this.loadBoard();
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

    this.saveState.set('saving');
    this.saveMessage.set('Saving schedule update...');
    try {
      await this.employeesData.updateScheduledHistoryEntry(
        entryId,
        {
          siteLabel: this.jobLabelControl.value.trim(),
          address: this.addressControl.value.trim(),
          scheduledStart: toIsoDateTime(this.scheduledStartControl.value),
          scheduledEnd: toIsoDateTime(this.scheduledEndControl.value),
        },
        actorRole,
      );
      this.editingHistoryEntryId.set(null);
      this.saveState.set('success');
      this.saveMessage.set('Schedule updated.');
      await this.loadBoard();
      return true;
    } catch {
      this.saveState.set('error');
      this.saveMessage.set('Unable to update the schedule right now.');
      return false;
    }
  }

  async cancelScheduledHistoryEntry(
    entryId: string,
    actorRole: EmployeeOperatorRole = 'owner',
  ): Promise<boolean> {
    this.saveState.set('saving');
    this.saveMessage.set('Cancelling scheduled assignment...');
    try {
      await this.employeesData.cancelScheduledHistoryEntry(entryId, actorRole);
      if (this.editingHistoryEntryId() === entryId) {
        this.editingHistoryEntryId.set(null);
      }
      this.removeSelectedHistoryIds([entryId]);
      this.saveState.set('success');
      this.saveMessage.set('Scheduled assignment cancelled.');
      await this.loadBoard();
      return true;
    } catch {
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

    this.saveState.set('saving');
    this.saveMessage.set('Reassigning scheduled assignment...');
    try {
      await this.employeesData.reassignScheduledHistoryEntry(
        entry.id,
        {
          employeeId: target.employeeId,
        },
        actorRole,
      );
      if (this.editingHistoryEntryId() === entry.id) {
        this.editingHistoryEntryId.set(null);
      }
      this.removeSelectedHistoryIds([entry.id]);
      this.saveState.set('success');
      this.saveMessage.set(`Scheduled assignment moved to ${target.fullName}.`);
      await this.loadBoard();
      return true;
    } catch {
      this.saveState.set('error');
      this.saveMessage.set('Unable to reassign the scheduled assignment right now.');
      return false;
    }
  }

  async completeHistoryEntry(
    entryId: string,
    actorRole: EmployeeOperatorRole = 'owner',
  ): Promise<boolean> {
    this.saveState.set('saving');
    this.saveMessage.set('Marking assignment as completed...');
    try {
      await this.employeesData.completeJobHistoryEntry(entryId, actorRole);
      this.removeSelectedHistoryIds([entryId]);
      this.saveState.set('success');
      this.saveMessage.set('Assignment marked as completed.');
      await this.loadBoard();
      return true;
    } catch {
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

    this.saveState.set('saving');
    this.saveMessage.set(`Completing ${entries.length} scheduled assignment(s)...`);
    const results = await Promise.allSettled(
      entries.map((entry) =>
        this.employeesData.completeJobHistoryEntry(entry.id, actorRole),
      ),
    );
    const succeededIds = entries
      .filter((_, index) => results[index]?.status === 'fulfilled')
      .map((entry) => entry.id);
    const failedCount = entries.length - succeededIds.length;
    this.removeSelectedHistoryIds(succeededIds);

    if (failedCount === 0) {
      this.saveState.set('success');
      this.saveMessage.set(`Completed ${entries.length} scheduled assignment(s).`);
      await this.loadBoard();
      return true;
    }

    this.saveState.set('error');
    this.saveMessage.set(
      `Completed ${succeededIds.length} of ${entries.length} scheduled assignments. Retry the remaining ${failedCount}.`,
    );
    await this.loadBoard();
    return false;
  }

  async cancelSelectedHistoryEntries(
    actorRole: EmployeeOperatorRole = 'owner',
  ): Promise<boolean> {
    const entries = this.selectedScheduledHistoryEntries();
    if (!entries.length) {
      this.saveState.set('error');
      this.saveMessage.set('Select at least one scheduled assignment to cancel.');
      return false;
    }

    this.saveState.set('saving');
    this.saveMessage.set(`Cancelling ${entries.length} scheduled assignment(s)...`);
    const results = await Promise.allSettled(
      entries.map((entry) =>
        this.employeesData.cancelScheduledHistoryEntry(entry.id, actorRole),
      ),
    );
    const succeededIds = entries
      .filter((_, index) => results[index]?.status === 'fulfilled')
      .map((entry) => entry.id);
    const failedCount = entries.length - succeededIds.length;
    this.removeSelectedHistoryIds(succeededIds);

    if (failedCount === 0) {
      this.saveState.set('success');
      this.saveMessage.set(`Cancelled ${entries.length} scheduled assignment(s).`);
      await this.loadBoard();
      return true;
    }

    this.saveState.set('error');
    this.saveMessage.set(
      `Cancelled ${succeededIds.length} of ${entries.length} scheduled assignments. Retry the remaining ${failedCount}.`,
    );
    await this.loadBoard();
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
    return {
      jobLabel: this.jobLabelControl.value.trim(),
      address: this.addressControl.value.trim(),
      scheduledStart: toIsoDateTime(this.scheduledStartControl.value),
      scheduledEnd: toIsoDateTime(this.scheduledEndControl.value),
      employeeIds: this.selectedEmployeeIds(),
    };
  }

  private resetDraftAfterSave(): void {
    this.selectedEmployeeIdsSignal.set([]);
    this.queryControl.setValue('', { emitEvent: false });
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
