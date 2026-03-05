import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import type { ClientDetail, ClientSummary } from '../home/services/entry-repository.service.js';
import { createEmptyHedgeConfigs } from '../home/models/entry-modal.models.js';
import { EntryRepositoryService } from '../home/services/entry-repository.service.js';
import { ClientsShellComponent } from './clients-shell.component.js';

const baseClients: ClientSummary[] = [
  {
    clientId: 'alex@example.com',
    firstName: 'Alex',
    lastName: 'Stone',
    fullName: 'Alex Stone',
    address: '123 Pine Ave',
    phone: '(438) 555-1111',
    email: 'alex@example.com',
    jobsCount: 2,
    lastJobDate: '2026-03-04T12:00:00Z',
    nextJobDate: '2026-03-10T12:00:00Z',
  },
  {
    clientId: 'lana@example.com',
    firstName: 'Lana',
    lastName: 'Poe',
    fullName: 'Lana Poe',
    address: '55 Cedar St',
    phone: '(438) 555-2222',
    email: 'lana@example.com',
    jobsCount: 1,
    lastJobDate: '2026-02-10T15:00:00Z',
    nextJobDate: '2026-03-20T12:00:00Z',
  },
  {
    clientId: 'parking',
    firstName: 'Parking',
    lastName: 'Lot',
    fullName: 'Parking Lot',
    address: 'Near HQ',
    phone: '(438) 555-3333',
    jobsCount: 1,
    lastJobDate: '',
    nextJobDate: '',
  },
];

const clientDetail: ClientDetail = {
  ...baseClients[0],
  history: [
    {
      entryId: 'job-1',
      createdAt: '2026-03-04T12:00:00Z',
      variant: 'customer',
      jobType: 'Hedge Trimming',
      jobValue: '$850',
      location: '123 Pine Ave',
      contactPhone: '(438) 555-1111',
      contactEmail: 'alex@example.com',
      desiredBudget: '$700',
      additionalDetails: 'Bring debris bags.',
      calendar: {
        start: '2026-03-05T10:00:00Z',
        end: '2026-03-05T12:00:00Z',
        timeZone: 'America/Toronto',
      },
      hedges: createEmptyHedgeConfigs(),
      hedgePlan: ['Front Trim (i,t)'],
      form: {
        firstName: 'Alex',
        lastName: 'Stone',
        address: '123 Pine Ave',
        phone: '(438) 555-1111',
        email: 'alex@example.com',
        jobType: 'Hedge Trimming',
        jobValue: '$850',
        desiredBudget: '$700',
        additionalDetails: 'Bring debris bags.',
      },
    },
  ],
};

const secondClientDetail: ClientDetail = {
  ...baseClients[1],
  history: [
    {
      entryId: 'job-2',
      createdAt: '2026-03-10T14:00:00Z',
      variant: 'customer',
      jobType: 'Rabattage',
      jobValue: '$1,250',
      location: '55 Cedar St',
      contactPhone: '(438) 555-2222',
      calendar: {
        start: '2026-03-12T14:00:00Z',
        end: '2026-03-12T16:00:00Z',
        timeZone: 'America/Toronto',
      },
      hedges: createEmptyHedgeConfigs(),
      hedgePlan: [],
      form: {
        firstName: 'Lana',
        lastName: 'Poe',
        address: '55 Cedar St',
        phone: '(438) 555-2222',
        jobType: 'Rabattage',
        jobValue: '$1,250',
      },
    },
  ],
};

class EntryRepositoryServiceStub {
  listClients = vi.fn(() => Promise.resolve<ClientSummary[]>(baseClients));
  getClientDetail = vi.fn(() => Promise.resolve<ClientDetail>(clientDetail));
  updateClient = vi.fn(() => Promise.resolve<ClientSummary>(baseClients[0]));
  deleteClient = vi.fn(() => Promise.resolve());
  updateEntry = vi.fn(() => Promise.resolve());
  deleteEntry = vi.fn(() => Promise.resolve());
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
    expect(component.statsSnapshot().nextJobDate).toBe('2026-03-10T12:00:00Z');
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

  it('handles client update events', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await component.openClientDrawer(baseClients[0]);
    await fixture.whenStable();
    await component['handleClientUpdate']({ firstName: 'Alexis' });
    expect(repository.updateClient).toHaveBeenCalledWith('alex@example.com', { firstName: 'Alexis' });
  });

  it('handles client deletion', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    await component.openClientDrawer(baseClients[0]);
    await fixture.whenStable();
    await component['handleClientDelete']();
    expect(repository.deleteClient).toHaveBeenCalledWith('alex@example.com');
    confirmSpy.mockRestore();
  });

  it('opens entry editor and sends payload to modal', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await component.openClientDrawer(baseClients[0]);
    await fixture.whenStable();
    component['openEntryEditor'](clientDetail.history[0]);
    expect(component.entryEditorOpen()).toBe(true);
    expect(component.entryEditorPayload()?.form.firstName).toBe('Alex');
  });

  it('saves edited job via repository', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await component.openClientDrawer(baseClients[0]);
    await fixture.whenStable();
    component['openEntryEditor'](clientDetail.history[0]);
    const payload = {
      variant: clientDetail.history[0].variant,
      form: clientDetail.history[0].form,
      hedges: clientDetail.history[0].hedges,
      calendar: clientDetail.history[0].calendar,
    };
    await component['handleEntryEditorSaved'](payload);
    expect(repository.updateEntry).toHaveBeenCalledWith('job-1', expect.any(Object));
  });

  it('deletes job entries', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fixture.detectChanges();
    await fixture.whenStable();
    await component.openClientDrawer(baseClients[0]);
    await fixture.whenStable();
    await component['deleteHistoryEntry'](clientDetail.history[0]);
    expect(repository.deleteEntry).toHaveBeenCalledWith('job-1');
    confirmSpy.mockRestore();
  });

  it('no-ops client update/delete when no drawer is open', async () => {
    component.closeDrawer();
    await component['handleClientUpdate']({ firstName: 'Test' });
    expect(repository.updateClient).not.toHaveBeenCalledWith('missing');
    await component['handleClientDelete']();
    expect(repository.deleteClient).not.toHaveBeenCalled();
  });

  it('warns when client update/delete fail', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fixture.detectChanges();
    await fixture.whenStable();
    await component.openClientDrawer(baseClients[0]);
    await fixture.whenStable();
    repository.updateClient.mockRejectedValueOnce(new Error('fail'));
    await component['handleClientUpdate']({ firstName: 'Err' });
    repository.deleteClient.mockRejectedValueOnce(new Error('boom'));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await component['handleClientDelete']();
    confirmSpy.mockRestore();
    expect(warnSpy).toHaveBeenCalledWith('Failed to update client', expect.any(Error));
    expect(warnSpy).toHaveBeenCalledWith('Failed to delete client', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('guards entry editor actions without state', async () => {
    const payload = {
      variant: 'warm-lead' as const,
      form: clientDetail.history[0].form,
      hedges: clientDetail.history[0].hedges,
    };
    await component['handleEntryEditorSaved'](payload);
    expect(repository.updateEntry).not.toHaveBeenCalledWith('missing', expect.anything());
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await component['deleteHistoryEntry'](clientDetail.history[0]);
    confirmSpy.mockRestore();
    expect(repository.deleteEntry).not.toHaveBeenCalledWith('job-1');
  });

  it('warns when entry update/delete fail', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fixture.detectChanges();
    await fixture.whenStable();
    await component.openClientDrawer(baseClients[0]);
    await fixture.whenStable();
    component['openEntryEditor'](clientDetail.history[0]);
    repository.updateEntry.mockRejectedValueOnce(new Error('job-fail'));
    await component['handleEntryEditorSaved']({
      variant: clientDetail.history[0].variant,
      form: clientDetail.history[0].form,
      hedges: clientDetail.history[0].hedges,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    repository.deleteEntry.mockRejectedValueOnce(new Error('delete-fail'));
    await component['deleteHistoryEntry'](clientDetail.history[0]);
    confirmSpy.mockRestore();
    expect(warnSpy).toHaveBeenCalledWith('Failed to update job entry', expect.any(Error));
    expect(warnSpy).toHaveBeenCalledWith('Failed to delete entry', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('matches phone numbers regardless of punctuation', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    component['querySignal'].set('4385551111');
    fixture.detectChanges();
    expect(component.filteredClientsSnapshot()).toHaveLength(1);

    component['querySignal'].set('(438)5552222');
    fixture.detectChanges();
    expect(component.filteredClientsSnapshot()).toHaveLength(1);
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

  it('opens the client drawer and renders job history', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const firstCard = fixture.nativeElement.querySelector('.client-card') as HTMLButtonElement;
    firstCard.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(repository.getClientDetail).toHaveBeenCalledWith('alex@example.com');
    const drawer = fixture.nativeElement.querySelector('app-client-detail-drawer');
    expect(drawer).toBeTruthy();
    expect(drawer.textContent).toContain('Hedge Trimming');
  });

  it('shows error state in drawer and retries detail load', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    repository.getClientDetail.mockRejectedValueOnce(new Error('fail'));
    const firstCard = fixture.nativeElement.querySelector('.client-card') as HTMLButtonElement;
    firstCard.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const errorState = fixture.nativeElement.querySelector('.client-drawer__state--error');
    expect(errorState).toBeTruthy();

    repository.getClientDetail.mockResolvedValueOnce(clientDetail);
    const retryButton = fixture.nativeElement.querySelector('.client-drawer__section-heading .ghost') as HTMLButtonElement;
    retryButton.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(repository.getClientDetail).toHaveBeenCalledTimes(2);
  });

  it('reloads client detail when the drawer is open', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const firstCard = fixture.nativeElement.querySelector('.client-card') as HTMLButtonElement;
    firstCard.click();
    await fixture.whenStable();
    fixture.detectChanges();

    repository.getClientDetail.mockClear();
    await component.reloadClientDetail();
    expect(repository.getClientDetail).toHaveBeenCalledWith('alex@example.com');
  });

  it('ignores reloads when no client is active', async () => {
    await component.reloadClientDetail();
    expect(repository.getClientDetail).not.toHaveBeenCalled();
  });

  it('closes the drawer and clears state', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const firstCard = fixture.nativeElement.querySelector('.client-card') as HTMLButtonElement;
    firstCard.click();
    await fixture.whenStable();
    fixture.detectChanges();

    component.closeDrawer();
    fixture.detectChanges();
    expect(component.drawerVisible()).toBe(false);
  });

  it('ignores stale detail responses when switching quickly', async () => {
    const resolvers: ((detail: ClientDetail) => void)[] = [];
    repository.getClientDetail.mockImplementation(() => new Promise<ClientDetail>((resolve) => resolvers.push(resolve)));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const firstPromise = component.openClientDrawer(baseClients[0]);
    const secondPromise = component.openClientDrawer(baseClients[1]);

    resolvers[0](clientDetail);
    resolvers[1](secondClientDetail);

    await Promise.all([firstPromise, secondPromise]);
    fixture.detectChanges();

    expect(component.clientDetail()?.fullName).toBe('Lana Poe');
    repository.getClientDetail.mockImplementation(() => Promise.resolve(clientDetail));
  });

  it('closes the drawer when the backdrop is clicked', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const firstCard = fixture.nativeElement.querySelector('.client-card') as HTMLButtonElement;
    firstCard.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector('.client-detail-overlay__backdrop') as HTMLButtonElement;
    backdrop.click();
    fixture.detectChanges();
    expect(component.drawerVisible()).toBe(false);
  });
});
