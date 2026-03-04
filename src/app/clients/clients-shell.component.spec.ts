import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ClientSummary } from '../home/services/entry-repository.service.js';
import { EntryRepositoryService } from '../home/services/entry-repository.service.js';
import { ClientsShellComponent } from './clients-shell.component.js';

const baseClients: ClientSummary[] = [
  {
    clientId: 'alex@example.com',
    fullName: 'Alex Stone',
    address: '123 Pine Ave',
    phone: '(438) 555-1111',
    email: 'alex@example.com',
    jobsCount: 2,
    lastJobDate: '2026-03-04T12:00:00Z',
  },
  {
    clientId: 'lana@example.com',
    fullName: 'Lana Poe',
    address: '55 Cedar St',
    phone: '(438) 555-2222',
    email: 'lana@example.com',
    jobsCount: 1,
    lastJobDate: '2026-02-10T15:00:00Z',
  },
  {
    clientId: 'parking',
    fullName: 'Parking Lot',
    address: 'Near HQ',
    phone: '(438) 555-3333',
    jobsCount: 1,
    lastJobDate: '',
  },
];

class EntryRepositoryServiceStub {
  listClients = vi.fn(() => Promise.resolve<ClientSummary[]>(baseClients));
}

describe('ClientsShellComponent', () => {
  let component: ClientsShellComponent;
  let fixture: ComponentFixture<ClientsShellComponent>;
  let repository: EntryRepositoryServiceStub;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: EntryRepositoryService, useClass: EntryRepositoryServiceStub },
      ],
      imports: [ClientsShellComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientsShellComponent);
    component = fixture.componentInstance;
    repository = TestBed.inject(EntryRepositoryService) as unknown as EntryRepositoryServiceStub;
  });

  it('loads clients on init and computes stats', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(repository.listClients).toHaveBeenCalled();
    expect(component.statsSnapshot().totalClients).toBe(3);
    expect(component.statsSnapshot().totalJobs).toBe(4);
    expect(component.filteredClientsSnapshot()).toHaveLength(3);
  });

  it('filters clients based on the search query', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    component['querySignal'].set('pine');
    fixture.detectChanges();
    expect(component.filteredClientsSnapshot()).toHaveLength(1);

    component['querySignal'].set('no match');
    fixture.detectChanges();
    expect(component.filteredClientsSnapshot()).toHaveLength(0);
  });

  it('surfaces errors when the API call fails', async () => {
    repository.listClients.mockRejectedValueOnce(new Error('Network'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.loadState()).toBe('error');
    const errorState = fixture.nativeElement.querySelector('.clients-roster__state--error');
    expect(errorState?.textContent).toContain('load clients');
  });

  it('reacts to user input emitted through the search control', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    component.query.setValue('cedar');
    await new Promise((resolve) => setTimeout(resolve, 200));
    fixture.detectChanges();
    expect(component.filteredClientsSnapshot()[0].fullName).toContain('Lana');
  });

  it('reloads the roster when the refresh button is clicked', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    repository.listClients.mockClear();
    const refreshButton = fixture.nativeElement.querySelector('.refresh-btn') as HTMLButtonElement;
    refreshButton.click();
    await fixture.whenStable();
    expect(repository.listClients).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when no clients exist', async () => {
    repository.listClients.mockResolvedValueOnce([]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const emptyState = fixture.nativeElement.querySelector('.clients-roster__state--empty');
    expect(emptyState?.textContent).toContain('No clients match');
  });

  it('allows retrying after an error', async () => {
    repository.listClients.mockRejectedValueOnce(new Error('Network'));
    repository.listClients.mockResolvedValueOnce(baseClients);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const retryButton = fixture.nativeElement.querySelector('.clients-roster__state--error button') as HTMLButtonElement;
    retryButton.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.loadState()).toBe('ready');
  });
});
