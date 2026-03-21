import { Injectable } from '@angular/core';
import type { EmployeeHoursRecord, EmployeeRosterRecord } from './employees.types.js';

@Injectable({ providedIn: 'root' })
export class EmployeesDataService {
  async listEmployees(): Promise<EmployeeRosterRecord[]> {
    return Promise.resolve([
      {
        id: 'emp-karam',
        firstName: 'Karam',
        lastName: 'AbiNassif',
        fullName: 'Karam AbiNassif',
        phone: '(438) 555-1010',
        email: 'karam@ecocutqc.com',
        role: 'Crew lead',
        hourlyRate: 34,
        notes: 'Leads East-side crews.',
        status: 'active',
        lastActivityAt: '2026-03-20T14:00:00Z',
      },
      {
        id: 'emp-maryam',
        firstName: 'Maryam',
        lastName: 'Haddad',
        fullName: 'Maryam Haddad',
        phone: '(438) 555-2020',
        email: 'maryam@ecocutqc.com',
        role: 'Crew specialist',
        hourlyRate: 29,
        notes: 'Handles hedge contour finishing.',
        status: 'active',
        lastActivityAt: '2026-03-19T17:15:00Z',
      },
      {
        id: 'emp-youssef',
        firstName: 'Youssef',
        lastName: 'Bitar',
        fullName: 'Youssef Bitar',
        phone: '(438) 555-3030',
        email: null,
        role: 'Field support',
        hourlyRate: 25,
        notes: 'Seasonal availability only.',
        status: 'inactive',
        lastActivityAt: '2025-11-02T11:30:00Z',
      },
      {
        id: 'emp-nora',
        firstName: 'Nora',
        lastName: 'Sayegh',
        fullName: 'Nora Sayegh',
        phone: '(438) 555-4040',
        email: 'nora@ecocutqc.com',
        role: 'Estimator',
        hourlyRate: 31,
        notes: 'Provides quote walkthroughs.',
        status: 'active',
        lastActivityAt: null,
      },
    ]);
  }

  async listHoursEntries(): Promise<EmployeeHoursRecord[]> {
    return Promise.resolve([
      {
        id: 'hours-karam-2026-03-20',
        employeeId: 'emp-karam',
        workDate: '2026-03-20',
        siteLabel: 'Westmount - Pine Ave',
        hours: 8,
        updatedByRole: 'owner',
        updatedAt: '2026-03-20T19:12:00Z',
      },
      {
        id: 'hours-maryam-2026-03-19',
        employeeId: 'emp-maryam',
        workDate: '2026-03-19',
        siteLabel: 'Outremont - Maple Lane',
        hours: 7.5,
        updatedByRole: 'manager',
        updatedAt: '2026-03-19T18:45:00Z',
      },
      {
        id: 'hours-nora-2026-03-18',
        employeeId: 'emp-nora',
        workDate: '2026-03-18',
        siteLabel: 'NDG - Cedar Ridge',
        hours: 6,
        updatedByRole: 'owner',
        updatedAt: '2026-03-18T16:03:00Z',
      },
    ]);
  }
}
