import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { EmployeesDataService } from './employees-data.service.js';

describe('EmployeesDataService', () => {
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/employees`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [EmployeesDataService],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads roster/hours/history/readiness from API', async () => {
    const service = TestBed.inject(EmployeesDataService);

    const rosterPromise = service.listEmployees();
    const hoursPromise = service.listHoursEntries();
    const historyPromise = service.listJobHistoryEntries();
    const readinessPromise = service.listStartNextJobReadiness();

    const rosterReq = httpMock.expectOne(`${baseUrl}/roster`);
    const hoursReq = httpMock.expectOne(`${baseUrl}/hours`);
    const historyReq = httpMock.expectOne(`${baseUrl}/history`);
    const readinessReq = httpMock.expectOne(`${baseUrl}/readiness`);

    expect(rosterReq.request.method).toBe('GET');
    expect(hoursReq.request.method).toBe('GET');
    expect(historyReq.request.method).toBe('GET');
    expect(readinessReq.request.method).toBe('GET');

    rosterReq.flush([{ id: 'emp-1' }]);
    hoursReq.flush([{ id: 'hours-1' }]);
    historyReq.flush([{ id: 'job-1' }]);
    readinessReq.flush([{ employeeId: 'emp-1' }]);

    await expect(rosterPromise).resolves.toHaveLength(1);
    await expect(hoursPromise).resolves.toHaveLength(1);
    await expect(historyPromise).resolves.toHaveLength(1);
    await expect(readinessPromise).resolves.toHaveLength(1);
  });

  it('sends operator role headers for mutating endpoints', async () => {
    const service = TestBed.inject(EmployeesDataService);

    const createProfilePromise = service.createEmployeeProfile(
      {
        firstName: 'Lina',
        lastName: 'Sarkis',
        phone: '(438) 555-1000',
        role: 'Crew',
        hourlyRate: 28,
      },
      'manager',
    );
    const updateProfilePromise = service.updateEmployeeProfile(
      'emp-1',
      {
        firstName: 'Lina',
        lastName: 'Sarkis',
        phone: '(438) 555-1000',
        role: 'Crew',
        hourlyRate: 29,
      },
      'owner',
    );
    const archivePromise = service.archiveEmployee('emp-1', 'owner');
    const createHoursPromise = service.createHoursEntry(
      {
        employeeId: 'emp-1',
        workDate: '2026-03-21',
        siteLabel: 'Laval',
        hours: 7,
      },
      'manager',
    );
    const updateHoursPromise = service.updateHoursEntry(
      'hours-1',
      {
        workDate: '2026-03-21',
        siteLabel: 'Laval',
        hours: 8,
      },
      'owner',
    );
    const removeHoursPromise = service.removeHoursEntry('hours-1', 'manager');

    const createProfileReq = httpMock.expectOne(`${baseUrl}/roster`);
    const updateProfileReq = httpMock.expectOne(`${baseUrl}/roster/emp-1`);
    const archiveReq = httpMock.expectOne(`${baseUrl}/roster/emp-1/archive`);
    const createHoursReq = httpMock.expectOne(`${baseUrl}/hours`);
    const hoursByIdReqs = httpMock.match(`${baseUrl}/hours/hours-1`);
    expect(hoursByIdReqs).toHaveLength(2);
    const updateHoursReq = hoursByIdReqs.find((req) => req.request.method === 'PATCH');
    const removeHoursReq = hoursByIdReqs.find((req) => req.request.method === 'DELETE');

    expect(createProfileReq.request.method).toBe('POST');
    expect(updateProfileReq.request.method).toBe('PATCH');
    expect(archiveReq.request.method).toBe('POST');
    expect(createHoursReq.request.method).toBe('POST');
    expect(updateHoursReq?.request.method).toBe('PATCH');
    expect(removeHoursReq?.request.method).toBe('DELETE');

    expect(createProfileReq.request.headers.get('x-operator-role')).toBe('manager');
    expect(updateProfileReq.request.headers.get('x-operator-role')).toBe('owner');
    expect(archiveReq.request.headers.get('x-operator-role')).toBe('owner');
    expect(createHoursReq.request.headers.get('x-operator-role')).toBe('manager');
    expect(updateHoursReq?.request.headers.get('x-operator-role')).toBe('owner');
    expect(removeHoursReq?.request.headers.get('x-operator-role')).toBe('manager');

    createProfileReq.flush({ id: 'emp-1' });
    updateProfileReq.flush({ id: 'emp-1' });
    archiveReq.flush({ id: 'emp-1', status: 'inactive' });
    createHoursReq.flush({ id: 'hours-1' });
    updateHoursReq?.flush({ id: 'hours-1' });
    removeHoursReq?.flush(null);

    await expect(createProfilePromise).resolves.toMatchObject({ id: 'emp-1' });
    await expect(updateProfilePromise).resolves.toMatchObject({ id: 'emp-1' });
    await expect(archivePromise).resolves.toMatchObject({ id: 'emp-1' });
    await expect(createHoursPromise).resolves.toMatchObject({ id: 'hours-1' });
    await expect(updateHoursPromise).resolves.toMatchObject({ id: 'hours-1' });
    await expect(removeHoursPromise).resolves.toBeUndefined();
  });
});
