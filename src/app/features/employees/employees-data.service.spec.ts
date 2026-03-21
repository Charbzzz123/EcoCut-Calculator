import { TestBed } from '@angular/core/testing';
import { EmployeesDataService } from './employees-data.service.js';

describe('EmployeesDataService', () => {
  it('returns seeded employee and hours records', async () => {
    TestBed.configureTestingModule({ providers: [EmployeesDataService] });
    const service = TestBed.inject(EmployeesDataService);

    const employees = await service.listEmployees();
    const hoursEntries = await service.listHoursEntries();

    expect(employees.length).toBeGreaterThan(1);
    expect(employees.some((employee) => employee.status === 'active')).toBe(true);
    expect(employees.some((employee) => employee.status === 'inactive')).toBe(true);
    expect(hoursEntries.length).toBeGreaterThan(1);
    expect(hoursEntries.every((entry) => entry.hours > 0)).toBe(true);
  });
});
