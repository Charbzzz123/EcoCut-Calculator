import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import type {
  ClientDetail,
  ClientHistoryEntry,
  ClientSummary,
} from '@shared/domain/entry/entry-repository.service.js';
import { EntryRepositoryService } from '@shared/domain/entry/entry-repository.service.js';
import { createEmptyHedgeConfigs } from '@shared/domain/entry/entry-modal.models.js';
import { EntryModalPayload } from '@shared/domain/entry/entry-modal.models.js';
import { ClientsFacade } from './clients.facade.js';

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
      hedgePlan: ['Left Trim T'],
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
      hedgePlan: ['Back Rabattage T'],
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

describe('ClientsFacade', () => {
  let facade: ClientsFacade;
  let repository: EntryRepositoryServiceStub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ClientsFacade,
        { provide: EntryRepositoryService, useClass: EntryRepositoryServiceStub },
      ],
    });
    facade = TestBed.inject(ClientsFacade);
    repository = TestBed.inject(EntryRepositoryService) as unknown as EntryRepositoryServiceStub;
  });

  it('loads clients and computes stats', async () => {
    await facade.loadClients();
    expect(repository.listClients).toHaveBeenCalled();
    expect(facade.statsSnapshot().totalClients).toBe(3);
    expect(facade.statsSnapshot().totalJobs).toBe(4);
    expect(facade.loadStateSnapshot()).toBe('ready');
    expect(facade.trackByClientId(0, baseClients[0])).toBe('alex@example.com');
    expect(facade.drawerVisible()).toBe(false);
  });

  it('keeps active selection untouched when roster refresh no longer includes it', async () => {
    await facade.openClientDrawer(baseClients[0]);
    repository.listClients.mockResolvedValueOnce([baseClients[1], baseClients[2]]);
    await facade.loadClients();
    expect(facade.activeClient()?.clientId).toBe('alex@example.com');
  });

  it('filters clients from the query control', async () => {
    await facade.loadClients();
    facade.queryControl.setValue('cedar');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(facade.filteredClientsSnapshot()[0].fullName).toBe('Lana Poe');
    facade.queryControl.setValue('4385551111');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(facade.filteredClientsSnapshot()).toHaveLength(1);
  });

  it('opens client drawers and fetches details', async () => {
    await facade.loadClients();
    await facade.openClientDrawer(baseClients[0]);
    expect(repository.getClientDetail).toHaveBeenCalledWith('alex@example.com');
    expect(facade.clientDetail()?.fullName).toBe('Alex Stone');
  });

  it('ignores stale detail responses', async () => {
    const resolvers: ((detail: ClientDetail) => void)[] = [];
    repository.getClientDetail.mockImplementation(
      () =>
        new Promise<ClientDetail>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const first = facade.openClientDrawer(baseClients[0]);
    const second = facade.openClientDrawer(baseClients[1]);
    resolvers[0](clientDetail);
    resolvers[1](secondClientDetail);
    await Promise.all([first, second]);
    expect(facade.clientDetail()?.fullName).toBe('Lana Poe');
  });

  it('handles client updates/deletes', async () => {
    await facade.openClientDrawer(baseClients[0]);
    await facade.handleClientUpdate({ firstName: 'Alexis' });
    expect(repository.updateClient).toHaveBeenCalledWith('alex@example.com', { firstName: 'Alexis' });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await facade.handleClientDelete();
    expect(repository.deleteClient).toHaveBeenCalledWith('alex@example.com');
    confirmSpy.mockRestore();
  });

  it('gracefully handles load failures', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    repository.listClients.mockRejectedValueOnce(new Error('boom'));
    await facade.loadClients();
    expect(warnSpy).toHaveBeenCalledWith('Failed to load clients roster', expect.any(Error));
    expect(facade.loadState()).toBe('error');
    warnSpy.mockRestore();
  });

  it('returns all clients when query blank', async () => {
    await facade.loadClients();
    facade.queryControl.setValue('   ');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(facade.filteredClientsSnapshot()).toHaveLength(3);
  });

  it('reloads client detail only when selection exists', async () => {
    await facade.reloadClientDetail();
    expect(repository.getClientDetail).not.toHaveBeenCalled();
    await facade.openClientDrawer(baseClients[0]);
    await facade.reloadClientDetail();
    expect(repository.getClientDetail).toHaveBeenCalledWith('alex@example.com');
  });

  it('no-ops client update/delete when nothing selected', async () => {
    await facade.handleClientUpdate({ firstName: 'Nobody' });
    expect(repository.updateClient).not.toHaveBeenCalled();
    await facade.handleClientDelete();
    expect(repository.deleteClient).not.toHaveBeenCalled();
  });

  it('cancels client deletion when confirm is dismissed', async () => {
    await facade.openClientDrawer(baseClients[0]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await facade.handleClientDelete();
    expect(repository.deleteClient).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('updates drawer visibility as clients change', async () => {
    expect(facade.drawerVisible()).toBe(false);
    await facade.openClientDrawer(baseClients[0]);
    expect(facade.drawerVisible()).toBe(true);
    facade.closeDrawer();
    expect(facade.drawerVisible()).toBe(false);
  });

  it('refuses to open entry editor without an active client', () => {
    facade.closeDrawer();
    facade.openEntryEditor(clientDetail.history[0]);
    expect(facade.entryEditorOpen()).toBe(false);
  });

  it('ignores entry save/delete when cancelled', async () => {
    await facade.handleEntryEditorSaved({
      variant: 'customer',
      form: clientDetail.history[0]!.form!,
      hedges: clientDetail.history[0]!.hedges,
    });
    expect(repository.updateEntry).not.toHaveBeenCalled();

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await facade.deleteHistoryEntry(clientDetail.history[0]);
    expect(repository.deleteEntry).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('handles client detail failures', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    repository.getClientDetail.mockRejectedValueOnce(new Error('detail-fail'));
    await facade.openClientDrawer(baseClients[0]);
    expect(facade.detailState()).toBe('error');
    warnSpy.mockRestore();
  });

  it('ignores stale errors while loading details', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const handlers: {
      reject: (err: Error) => void;
      resolve: (detail: ClientDetail) => void;
    }[] = [];
    repository.getClientDetail.mockImplementation(
      () =>
        new Promise<ClientDetail>((resolve, reject) => {
          handlers.push({ resolve, reject });
        }),
    );
    const first = facade.openClientDrawer(baseClients[0]);
    const second = facade.openClientDrawer(baseClients[1]);
    handlers[0].reject(new Error('first-fail'));
    handlers[1].reject(new Error('second-fail'));
    await first;
    await second;
    warnSpy.mockRestore();
  });

  it('warns when client operations fail', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await facade.openClientDrawer(baseClients[0]);
    repository.updateClient.mockRejectedValueOnce(new Error('fail'));
    await facade.handleClientUpdate({ firstName: 'Err' });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    repository.deleteClient.mockRejectedValueOnce(new Error('boom'));
    await facade.handleClientDelete();
    confirmSpy.mockRestore();
    expect(warnSpy).toHaveBeenCalledWith('Failed to update client', expect.any(Error));
    expect(warnSpy).toHaveBeenCalledWith('Failed to delete client', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('opens the entry editor and emits payloads', async () => {
    await facade.openClientDrawer(baseClients[0]);
    facade.openEntryEditor(clientDetail.history[0]);
    expect(facade.entryEditorOpen()).toBe(true);
    expect(facade.entryEditorPayload()?.form?.firstName).toBe('Alex');
  });

  it('saves edited jobs and closes the editor', async () => {
    await facade.openClientDrawer(baseClients[0]);
    facade.openEntryEditor(clientDetail.history[0]);
    const payload: EntryModalPayload = {
      variant: clientDetail.history[0].variant,
      form: clientDetail.history[0].form!,
      hedges: clientDetail.history[0].hedges,
      calendar: clientDetail.history[0].calendar,
    };
    await facade.handleEntryEditorSaved(payload);
    expect(repository.updateEntry).toHaveBeenCalledWith('job-1', expect.any(Object));
    expect(facade.entryEditorOpen()).toBe(false);
  });

  it('deletes history entries', async () => {
    await facade.openClientDrawer(baseClients[0]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await facade.deleteHistoryEntry(clientDetail.history[0] as ClientHistoryEntry);
    expect(repository.deleteEntry).toHaveBeenCalledWith('job-1');
    confirmSpy.mockRestore();
  });

  it('warns when entry operations fail', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await facade.openClientDrawer(baseClients[0]);
    facade.openEntryEditor(clientDetail.history[0]);
    repository.updateEntry.mockRejectedValueOnce(new Error('job-fail'));
    await facade.handleEntryEditorSaved({
      variant: clientDetail.history[0].variant,
      form: clientDetail.history[0].form!,
      hedges: clientDetail.history[0].hedges,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    repository.deleteEntry.mockRejectedValueOnce(new Error('delete-fail'));
    await facade.deleteHistoryEntry(clientDetail.history[0]);
    confirmSpy.mockRestore();
    expect(warnSpy).toHaveBeenCalledWith('Failed to update job entry', expect.any(Error));
    expect(warnSpy).toHaveBeenCalledWith('Failed to delete entry', expect.any(Error));
    warnSpy.mockRestore();
  });
});
