import { TestBed } from '@angular/core/testing';
import { EmployeesDataService } from './employees-data.service.js';

describe('EmployeesDataService', () => {
  it('returns seeded employee records with mixed status', async () => {
    TestBed.configureTestingModule({ providers: [EmployeesDataService] });
    const service = TestBed.inject(EmployeesDataService);

    const employees = await service.listEmployees();

    expect(employees.length).toBeGreaterThan(1);
    expect(employees.some((employee) => employee.status === 'active')).toBe(true);
    expect(employees.some((employee) => employee.status === 'inactive')).toBe(true);
  });
});
