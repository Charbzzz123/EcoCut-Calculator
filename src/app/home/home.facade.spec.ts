import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { HomeFacade } from './home.facade.js';
import { HomeDataService } from './home-data.service.js';

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

  beforeEach(() => {
    router = new RouterStub();
    TestBed.configureTestingModule({
      providers: [HomeFacade, HomeDataService, { provide: Router, useValue: router }],
    });
    facade = TestBed.inject(HomeFacade);
  });

  it('provides hero metrics data', () => {
    expect(facade.heroMetrics().length).toBeGreaterThan(0);
  });

  it('handles navigation quick actions', () => {
    const expectations: Array<{ command: Parameters<HomeFacade['handleQuickAction']>[0]; url: string }> = [
      { command: 'new-job', url: '/jobs/new' },
      { command: 'start-next-job', url: '/jobs/next' },
      { command: 'manage-employees', url: '/admin/employees' },
      { command: 'view-employee-directory', url: '/admin/employees/directory' },
      { command: 'view-clients', url: '/clients' },
      { command: 'view-schedule', url: '/schedule' },
      { command: 'view-finances', url: '/finances' },
      { command: 'view-upcoming-pay', url: '/payroll/upcoming' },
      { command: 'view-performance', url: '/analytics/performance' },
      { command: 'broadcast-clients', url: '/communications/broadcast' },
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
    facade.handleQuickAction('unknown' as any);
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
});

