import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { CreateEmployeeDto } from './dto/create-employee.dto';
import type { CreateHoursEntryDto } from './dto/create-hours-entry.dto';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';
import type { UpdateHoursEntryDto } from './dto/update-hours-entry.dto';
import { EmployeesRepository } from './employees.repository';
import type {
  EmployeeAvailabilityWindow,
  EmployeeHoursRecord,
  EmployeeJobHistoryRecord,
  EmployeeOperatorRole,
  EmployeeProfileRecord,
  EmployeeStartNextJobReadiness,
  EmployeesSnapshot,
} from './employees.types';

const digitsOnly = (value: string): string => value.replace(/\D/g, '');
const normalizeText = (value: string): string => value.trim().toLowerCase();
const normalizeName = (firstName: string, lastName: string): string =>
  `${normalizeText(firstName)}|${normalizeText(lastName)}`;
const formatFullName = (firstName: string, lastName: string): string =>
  `${firstName.trim()} ${lastName.trim()}`.trim();
const toTimestamp = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};
const sortByHistoryStartDesc = (
  left: EmployeeJobHistoryRecord,
  right: EmployeeJobHistoryRecord,
): number => right.scheduledStart.localeCompare(left.scheduledStart);
const sortByHistoryStartAsc = (
  left: EmployeeJobHistoryRecord,
  right: EmployeeJobHistoryRecord,
): number => left.scheduledStart.localeCompare(right.scheduledStart);

const phonePattern = /^\(\d{3}\)\s\d{3}-\d{4}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class EmployeesService implements OnModuleInit {
  private snapshot: EmployeesSnapshot = {
    roster: [],
    hours: [],
    history: [],
  };

  constructor(private readonly repository: EmployeesRepository) {}

  async onModuleInit(): Promise<void> {
    this.snapshot = await this.repository.loadSnapshot();
  }

  listRoster(): EmployeeProfileRecord[] {
    return this.snapshot.roster;
  }

  listHoursEntries(): EmployeeHoursRecord[] {
    return this.snapshot.hours;
  }

  listJobHistoryEntries(): EmployeeJobHistoryRecord[] {
    return this.snapshot.history;
  }

  listStartNextJobReadiness(): EmployeeStartNextJobReadiness[] {
    return this.computeReadiness(this.snapshot.roster, this.snapshot.history);
  }

  async createEmployeeProfile(
    payload: CreateEmployeeDto,
    actorRole: EmployeeOperatorRole,
  ): Promise<EmployeeProfileRecord> {
    this.assertOwnerOrManager(actorRole);
    const draft = this.normalizeProfileDraft(payload);
    this.validateProfileDraft(draft);
    this.assertNoDuplicateProfile(draft);

    const created: EmployeeProfileRecord = {
      id: this.createEmployeeId(draft.firstName, draft.lastName),
      firstName: draft.firstName,
      lastName: draft.lastName,
      fullName: formatFullName(draft.firstName, draft.lastName),
      phone: draft.phone,
      email: draft.email ?? null,
      role: draft.role,
      hourlyRate: draft.hourlyRate,
      notes: draft.notes ?? '',
      status: 'active',
      lastActivityAt: null,
    };

    this.snapshot = {
      ...this.snapshot,
      roster: [created, ...this.snapshot.roster],
    };
    await this.persistSnapshot();
    return created;
  }

  async updateEmployeeProfile(
    employeeId: string,
    payload: UpdateEmployeeDto,
    actorRole: EmployeeOperatorRole,
  ): Promise<EmployeeProfileRecord> {
    this.assertOwner(actorRole);
    const existing = this.requireEmployee(employeeId);
    const draft = this.normalizeProfileDraft({
      firstName: payload.firstName ?? existing.firstName,
      lastName: payload.lastName ?? existing.lastName,
      phone: payload.phone ?? existing.phone,
      email: payload.email ?? existing.email ?? undefined,
      role: payload.role ?? existing.role,
      hourlyRate: payload.hourlyRate ?? existing.hourlyRate,
      notes: payload.notes ?? existing.notes,
    });

    this.validateProfileDraft(draft);
    this.assertNoDuplicateProfile(draft, employeeId);

    const updated: EmployeeProfileRecord = {
      ...existing,
      firstName: draft.firstName,
      lastName: draft.lastName,
      fullName: formatFullName(draft.firstName, draft.lastName),
      phone: draft.phone,
      email: draft.email ?? null,
      role: draft.role,
      hourlyRate: draft.hourlyRate,
      notes: draft.notes ?? '',
    };

    this.snapshot = {
      ...this.snapshot,
      roster: this.snapshot.roster.map((employee) =>
        employee.id === employeeId ? updated : employee,
      ),
    };
    await this.persistSnapshot();
    return updated;
  }

  async archiveEmployee(
    employeeId: string,
    actorRole: EmployeeOperatorRole,
  ): Promise<EmployeeProfileRecord> {
    this.assertOwner(actorRole);
    const existing = this.requireEmployee(employeeId);
    const archived: EmployeeProfileRecord =
      existing.status === 'inactive'
        ? existing
        : {
            ...existing,
            status: 'inactive',
          };
    this.snapshot = {
      ...this.snapshot,
      roster: this.snapshot.roster.map((employee) =>
        employee.id === employeeId ? archived : employee,
      ),
    };
    await this.persistSnapshot();
    return archived;
  }

  async createHoursEntry(
    payload: CreateHoursEntryDto,
    actorRole: EmployeeOperatorRole,
  ): Promise<EmployeeHoursRecord> {
    this.assertOwnerOrManager(actorRole);
    const employee = this.requireEmployee(payload.employeeId);
    const draft = this.normalizeHoursDraft(payload);
    this.validateHoursDraft(draft);
    const now = new Date().toISOString();
    const created: EmployeeHoursRecord = {
      id: this.createHoursEntryId(payload.employeeId),
      employeeId: payload.employeeId,
      workDate: draft.workDate,
      siteLabel: draft.siteLabel,
      hours: draft.hours,
      updatedByRole: actorRole,
      updatedAt: now,
    };
    this.snapshot = {
      ...this.snapshot,
      hours: [created, ...this.snapshot.hours],
      roster: this.snapshot.roster.map((record) =>
        record.id === employee.id ? { ...record, lastActivityAt: now } : record,
      ),
    };
    await this.persistSnapshot();
    return created;
  }

  async updateHoursEntry(
    entryId: string,
    payload: UpdateHoursEntryDto,
    actorRole: EmployeeOperatorRole,
  ): Promise<EmployeeHoursRecord> {
    this.assertOwnerOrManager(actorRole);
    const existing = this.snapshot.hours.find((entry) => entry.id === entryId);
    if (!existing) {
      throw new NotFoundException(`Hours entry "${entryId}" not found.`);
    }

    const draft = this.normalizeHoursDraft({
      workDate: payload.workDate ?? existing.workDate,
      siteLabel: payload.siteLabel ?? existing.siteLabel,
      hours: payload.hours ?? existing.hours,
    });
    this.validateHoursDraft(draft);
    const now = new Date().toISOString();
    const updated: EmployeeHoursRecord = {
      ...existing,
      workDate: draft.workDate,
      siteLabel: draft.siteLabel,
      hours: draft.hours,
      updatedByRole: actorRole,
      updatedAt: now,
    };

    this.snapshot = {
      ...this.snapshot,
      hours: this.snapshot.hours.map((entry) =>
        entry.id === entryId ? updated : entry,
      ),
      roster: this.snapshot.roster.map((record) =>
        record.id === existing.employeeId
          ? { ...record, lastActivityAt: now }
          : record,
      ),
    };
    await this.persistSnapshot();
    return updated;
  }

  async removeHoursEntry(
    entryId: string,
    actorRole: EmployeeOperatorRole,
  ): Promise<void> {
    this.assertOwnerOrManager(actorRole);
    const existing = this.snapshot.hours.find((entry) => entry.id === entryId);
    if (!existing) {
      throw new NotFoundException(`Hours entry "${entryId}" not found.`);
    }
    this.snapshot = {
      ...this.snapshot,
      hours: this.snapshot.hours.filter((entry) => entry.id !== entryId),
    };
    await this.persistSnapshot();
  }

  private assertOwner(role: EmployeeOperatorRole): void {
    if (role !== 'owner') {
      throw new ForbiddenException(
        'Owner role required for this employees operation.',
      );
    }
  }

  private assertOwnerOrManager(role: EmployeeOperatorRole): void {
    if (role !== 'owner' && role !== 'manager') {
      throw new ForbiddenException('Invalid operator role.');
    }
  }

  private requireEmployee(employeeId: string): EmployeeProfileRecord {
    const existing = this.snapshot.roster.find(
      (employee) => employee.id === employeeId,
    );
    if (!existing) {
      throw new NotFoundException(`Employee "${employeeId}" not found.`);
    }
    return existing;
  }

  private normalizeProfileDraft(payload: CreateEmployeeDto): CreateEmployeeDto {
    return {
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      phone: payload.phone.trim(),
      email: payload.email?.trim() ?? undefined,
      role: payload.role.trim(),
      hourlyRate: Number(payload.hourlyRate),
      notes: payload.notes?.trim() ?? '',
    };
  }

  private validateProfileDraft(payload: CreateEmployeeDto): void {
    const missingFields: string[] = [];
    if (!payload.firstName) {
      missingFields.push('firstName');
    }
    if (!payload.lastName) {
      missingFields.push('lastName');
    }
    if (!payload.phone) {
      missingFields.push('phone');
    }
    if (!payload.role) {
      missingFields.push('role');
    }
    if (!Number.isFinite(payload.hourlyRate)) {
      missingFields.push('hourlyRate');
    }
    if (missingFields.length) {
      throw new BadRequestException(
        `Missing required employee fields: ${missingFields.join(', ')}`,
      );
    }
    if (!phonePattern.test(payload.phone)) {
      throw new BadRequestException('Phone must use format "(###) ###-####".');
    }
    if (payload.email && !emailPattern.test(payload.email)) {
      throw new BadRequestException('Email must be a valid address.');
    }
    if (payload.hourlyRate <= 0) {
      throw new BadRequestException('Hourly rate must be greater than 0.');
    }
  }

  private assertNoDuplicateProfile(
    payload: CreateEmployeeDto,
    ignoreEmployeeId?: string,
  ): void {
    const targetEmail = normalizeText(payload.email ?? '');
    const targetName = normalizeName(payload.firstName, payload.lastName);
    const targetPhoneDigits = digitsOnly(payload.phone);

    const duplicate = this.snapshot.roster.find((employee) => {
      if (ignoreEmployeeId && employee.id === ignoreEmployeeId) {
        return false;
      }
      const emailMatch =
        Boolean(targetEmail) &&
        normalizeText(employee.email ?? '') === targetEmail;
      const namePhoneMatch =
        Boolean(targetPhoneDigits) &&
        digitsOnly(employee.phone) === targetPhoneDigits &&
        normalizeName(employee.firstName, employee.lastName) === targetName;
      return emailMatch || namePhoneMatch;
    });
    if (duplicate) {
      throw new ConflictException(
        `Duplicate employee detected: ${duplicate.fullName}.`,
      );
    }
  }

  private normalizeHoursDraft(payload: {
    workDate: string;
    siteLabel: string;
    hours: number;
  }): { workDate: string; siteLabel: string; hours: number } {
    return {
      workDate: payload.workDate.trim(),
      siteLabel: payload.siteLabel.trim(),
      hours: Number(payload.hours),
    };
  }

  private validateHoursDraft(payload: {
    workDate: string;
    siteLabel: string;
    hours: number;
  }): void {
    const missingFields: string[] = [];
    if (!payload.workDate) {
      missingFields.push('workDate');
    }
    if (!payload.siteLabel) {
      missingFields.push('siteLabel');
    }
    if (!Number.isFinite(payload.hours)) {
      missingFields.push('hours');
    }
    if (missingFields.length) {
      throw new BadRequestException(
        `Missing required hours fields: ${missingFields.join(', ')}`,
      );
    }
    if (payload.hours <= 0 || payload.hours > 24) {
      throw new BadRequestException(
        'Hours must be greater than 0 and less than or equal to 24.',
      );
    }
  }

  private createEmployeeId(firstName: string, lastName: string): string {
    const slug = `${firstName}-${lastName}`.toLowerCase().replace(/\s+/g, '-');
    return `emp-${slug}-${Date.now()}`;
  }

  private createHoursEntryId(employeeId: string): string {
    return `hours-${employeeId}-${Date.now()}`;
  }

  private computeReadiness(
    roster: EmployeeProfileRecord[],
    history: EmployeeJobHistoryRecord[],
  ): EmployeeStartNextJobReadiness[] {
    const now = new Date();
    const nowIso = now.toISOString();
    const nowTimestamp = now.getTime();
    return roster
      .map((employee) => {
        const employeeHistory = history.filter(
          (entry) => entry.employeeId === employee.id,
        );
        const completedEntries = employeeHistory
          .filter((entry) => entry.status === 'completed')
          .sort(sortByHistoryStartDesc);
        const scheduledEntries = employeeHistory
          .filter((entry) => entry.status === 'scheduled')
          .sort(sortByHistoryStartAsc);
        const upcomingEntries = scheduledEntries.filter(
          (entry) => toTimestamp(entry.scheduledEnd) > nowTimestamp,
        );
        const activeEntries = upcomingEntries.filter(
          (entry) => toTimestamp(entry.scheduledStart) <= nowTimestamp,
        );
        const nextScheduledEntry = upcomingEntries[0];

        const readinessState =
          employee.status === 'inactive'
            ? 'inactive'
            : activeEntries.length
              ? 'scheduled'
              : 'available';
        const nextAvailableAt =
          employee.status === 'inactive'
            ? null
            : this.computeNextAvailableAt(
                upcomingEntries,
                activeEntries,
                nowIso,
              );

        return {
          employeeId: employee.id,
          fullName: employee.fullName,
          status: employee.status,
          readinessState,
          scheduledJobsCount: upcomingEntries.length,
          completedJobsCount: completedEntries.length,
          scheduledHours: upcomingEntries.reduce(
            (sum, entry) => sum + entry.hoursWorked,
            0,
          ),
          completedHours: completedEntries.reduce(
            (sum, entry) => sum + entry.hoursWorked,
            0,
          ),
          nextScheduledStart: nextScheduledEntry?.scheduledStart ?? null,
          nextScheduledEnd: nextScheduledEntry?.scheduledEnd ?? null,
          nextAvailableAt,
          lastCompletedAt: completedEntries[0]?.scheduledEnd ?? null,
          lastCompletedSite: completedEntries[0]?.siteLabel ?? null,
          hasScheduleConflict: this.detectScheduleConflict(upcomingEntries),
          upcomingWindows: upcomingEntries.map((entry) =>
            this.toAvailabilityWindow(entry),
          ),
        } satisfies EmployeeStartNextJobReadiness;
      })
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
  }

  private computeNextAvailableAt(
    upcomingEntries: EmployeeJobHistoryRecord[],
    activeEntries: EmployeeJobHistoryRecord[],
    nowIso: string,
  ): string {
    if (!upcomingEntries.length) {
      return nowIso;
    }
    if (!activeEntries.length) {
      return nowIso;
    }
    let availabilityTimestamp = Math.max(
      ...activeEntries.map((entry) => toTimestamp(entry.scheduledEnd)),
    );
    for (const entry of upcomingEntries) {
      const start = toTimestamp(entry.scheduledStart);
      if (start > availabilityTimestamp) {
        break;
      }
      availabilityTimestamp = Math.max(
        availabilityTimestamp,
        toTimestamp(entry.scheduledEnd),
      );
    }
    return new Date(availabilityTimestamp).toISOString();
  }

  private detectScheduleConflict(
    upcomingEntries: EmployeeJobHistoryRecord[],
  ): boolean {
    if (upcomingEntries.length <= 1) {
      return false;
    }
    for (let index = 1; index < upcomingEntries.length; index += 1) {
      const previous = upcomingEntries[index - 1];
      const current = upcomingEntries[index];
      if (!previous || !current) {
        continue;
      }
      if (
        toTimestamp(current.scheduledStart) < toTimestamp(previous.scheduledEnd)
      ) {
        return true;
      }
    }
    return false;
  }

  private toAvailabilityWindow(
    entry: EmployeeJobHistoryRecord,
  ): EmployeeAvailabilityWindow {
    return {
      jobId: entry.id,
      siteLabel: entry.siteLabel,
      address: entry.address,
      startAt: entry.scheduledStart,
      endAt: entry.scheduledEnd,
    };
  }

  private async persistSnapshot(): Promise<void> {
    await this.repository.saveSnapshot(this.snapshot);
  }
}
