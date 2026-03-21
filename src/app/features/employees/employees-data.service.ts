import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  EmployeeClockActionPayload,
  EmployeeHoursMutationPayload,
  EmployeeHoursRecord,
  EmployeeJobHistoryRecord,
  EmployeeOperatorRole,
  EmployeeProfileMutationPayload,
  EmployeeRosterRecord,
  EmployeeStartNextJobReadiness,
} from './employees.types.js';

@Injectable({ providedIn: 'root' })
export class EmployeesDataService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/employees`;

  async listEmployees(): Promise<EmployeeRosterRecord[]> {
    return firstValueFrom(this.http.get<EmployeeRosterRecord[]>(`${this.baseUrl}/roster`));
  }

  async listHoursEntries(): Promise<EmployeeHoursRecord[]> {
    return firstValueFrom(this.http.get<EmployeeHoursRecord[]>(`${this.baseUrl}/hours`));
  }

  async listJobHistoryEntries(): Promise<EmployeeJobHistoryRecord[]> {
    return firstValueFrom(this.http.get<EmployeeJobHistoryRecord[]>(`${this.baseUrl}/history`));
  }

  async listStartNextJobReadiness(): Promise<EmployeeStartNextJobReadiness[]> {
    return firstValueFrom(
      this.http.get<EmployeeStartNextJobReadiness[]>(`${this.baseUrl}/readiness`),
    );
  }

  async createEmployeeProfile(
    payload: EmployeeProfileMutationPayload,
    actorRole: EmployeeOperatorRole,
  ): Promise<EmployeeRosterRecord> {
    return firstValueFrom(
      this.http.post<EmployeeRosterRecord>(`${this.baseUrl}/roster`, payload, {
        headers: this.operatorHeaders(actorRole),
      }),
    );
  }

  async updateEmployeeProfile(
    employeeId: string,
    payload: EmployeeProfileMutationPayload,
    actorRole: EmployeeOperatorRole,
  ): Promise<EmployeeRosterRecord> {
    return firstValueFrom(
      this.http.patch<EmployeeRosterRecord>(`${this.baseUrl}/roster/${employeeId}`, payload, {
        headers: this.operatorHeaders(actorRole),
      }),
    );
  }

  async archiveEmployee(
    employeeId: string,
    actorRole: EmployeeOperatorRole,
  ): Promise<EmployeeRosterRecord> {
    return firstValueFrom(
      this.http.post<EmployeeRosterRecord>(`${this.baseUrl}/roster/${employeeId}/archive`, null, {
        headers: this.operatorHeaders(actorRole),
      }),
    );
  }

  async createHoursEntry(
    payload: EmployeeHoursMutationPayload,
    actorRole: EmployeeOperatorRole,
  ): Promise<EmployeeHoursRecord> {
    return firstValueFrom(
      this.http.post<EmployeeHoursRecord>(`${this.baseUrl}/hours`, payload, {
        headers: this.operatorHeaders(actorRole),
      }),
    );
  }

  async recordClockAction(
    payload: EmployeeClockActionPayload,
    actorRole: EmployeeOperatorRole,
  ): Promise<EmployeeHoursRecord> {
    return firstValueFrom(
      this.http.post<EmployeeHoursRecord>(`${this.baseUrl}/hours/clock`, payload, {
        headers: this.operatorHeaders(actorRole),
      }),
    );
  }

  async updateHoursEntry(
    entryId: string,
    payload: Omit<EmployeeHoursMutationPayload, 'employeeId'>,
    actorRole: EmployeeOperatorRole,
  ): Promise<EmployeeHoursRecord> {
    return firstValueFrom(
      this.http.patch<EmployeeHoursRecord>(`${this.baseUrl}/hours/${entryId}`, payload, {
        headers: this.operatorHeaders(actorRole),
      }),
    );
  }

  async removeHoursEntry(entryId: string, actorRole: EmployeeOperatorRole): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/hours/${entryId}`, {
        headers: this.operatorHeaders(actorRole),
      }),
    );
  }

  private operatorHeaders(role: EmployeeOperatorRole): HttpHeaders {
    return new HttpHeaders({
      'x-operator-role': role,
    });
  }
}
