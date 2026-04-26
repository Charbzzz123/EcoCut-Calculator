import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { HomeFacade } from './home.facade.js';
import { HomeDataService } from './home-data.service.js';
import type { EntryModalPayload, HedgeConfig, HedgeId } from '@shared/domain/entry/entry-modal.models.js';
import { HEDGE_IDS } from '@shared/domain/entry/entry-modal.models.js';

class RouterStub {
  lastUrl: string | null = null;
  shouldReject = false;
  navigateByUrl(url: string) {
    this.lastUrl = url;
    if (this.shouldReject) {
      return Promise.reject(new Error('navigation blocked'));
    }
    return Promise.resolve(true);
  }
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('HomeFacade', () => {
  let facade: HomeFacade;
  let router: RouterStub;
  let data: HomeDataService;

  beforeEach(() => {
    router = new RouterStub();
    TestBed.configureTestingModule({
      providers: [HomeFacade, HomeDataService, { provide: Router, useValue: router }],
    });
    facade = TestBed.inject(HomeFacade);
    data = TestBed.inject(HomeDataService);
  });

  it('provides hero metrics data', () => {
    expect(facade.heroMetrics().length).toBeGreaterThan(0);
  });

  it('handles navigation quick actions', () => {
    const expectations: { command: Parameters<HomeFacade['handleQuickAction']>[0]; url: string }[] = [
      { command: 'new-job', url: '/jobs/new' },
      { command: 'start-next-job', url: '/jobs/start' },
      { command: 'view-clients', url: '/clients' },
      { command: 'view-schedule', url: '/schedule' },
      { command: 'manage-employees', url: '/employees/manage' },
      { command: 'view-employee-directory', url: '/admin/employees/directory' },
      { command: 'view-finances', url: '/finances' },
      { command: 'view-upcoming-pay', url: '/payroll/upcoming' },
      { command: 'view-performance', url: '/analytics/performance' },
      { command: 'broadcast-clients', url: '/communications/broadcast' },
      { command: 'open-chats', url: '/communications/chats' },
      { command: 'advanced-options', url: '/admin/advanced' },
    ];

    expectations.forEach(({ command, url }) => {
      facade.handleQuickAction(command);
      expect(router.lastUrl).toBe(url);
    });
  });

  it('logs when undo action is triggered', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    facade.handleQuickAction('undo-job');
    expect(infoSpy).toHaveBeenCalledWith('Undo last entry triggered');
    infoSpy.mockRestore();
  });

  it('warns on unknown quick actions', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    facade.handleQuickAction('unknown' as unknown as Parameters<HomeFacade['handleQuickAction']>[0]);
    expect(warnSpy).toHaveBeenCalledWith('Unhandled quick action', 'unknown');
    warnSpy.mockRestore();
  });

  it('reports navigation failures', async () => {
    router.shouldReject = true;
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    facade.startNewJob();
    await flushPromises();

    expect(infoSpy).toHaveBeenCalledWith('Navigation target "/jobs/new" is not ready yet.');
    infoSpy.mockRestore();
  });

  it('provides entry points for warm leads and closed customers', () => {
    facade.startWarmLead();
    expect(router.lastUrl).toBe('/leads/new');

    facade.startCustomerClosed();
    expect(router.lastUrl).toBe('/customers/new');
  });

  it('delegates entry capture to the data service', async () => {
    const emptyHedges = HEDGE_IDS.reduce(
      (acc, id) => ({ ...acc, [id]: { state: 'none' } }),
      {} as Record<HedgeId, HedgeConfig>,
    );

    const payload: EntryModalPayload = {
      variant: 'warm-lead',
      form: {
        firstName: 'Amy',
        lastName: 'D',
        address: '1 Main',
        phone: '123',
        jobType: 'Hedge Trimming',
        jobValue: '1000',
      },
      hedges: emptyHedges,
    };

    const saveSpy = vi.spyOn(data, 'saveEntry').mockResolvedValue();

    await facade.captureEntry(payload);

    expect(saveSpy).toHaveBeenCalledWith(payload);
  });

  it('surfaces data service errors when entry capture fails', async () => {
    const emptyHedges = HEDGE_IDS.reduce(
      (acc, id) => ({ ...acc, [id]: { state: 'none' } }),
      {} as Record<HedgeId, HedgeConfig>,
    );
    const payload = {
      variant: 'customer',
      form: { firstName: 'B', lastName: 'C', address: 'X', phone: 'Y', jobType: 'Both', jobValue: '200' },
      hedges: emptyHedges,
    } satisfies EntryModalPayload;

    const error = new Error('save failed');
    vi.spyOn(data, 'saveEntry').mockRejectedValue(error);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(facade.captureEntry(payload)).rejects.toThrow(error);
    expect(warnSpy).toHaveBeenCalledWith('Failed to persist entry payload', error);
    warnSpy.mockRestore();
  });
});

