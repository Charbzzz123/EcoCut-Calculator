import { Injectable } from '@angular/core';
import type { EmployeeRosterRecord } from './employees.types.js';

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
        status: 'active',
        lastActivityAt: null,
      },
    ]);
  }
}
