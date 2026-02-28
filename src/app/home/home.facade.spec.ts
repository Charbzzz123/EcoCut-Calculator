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
    facade.handleQuickAction('new-job');
    expect(router.lastUrl).toBe('/jobs/new');

    facade.handleQuickAction('manage-employees');
    expect(router.lastUrl).toBe('/admin/employees');

    facade.handleQuickAction('advanced-options');
    expect(router.lastUrl).toBe('/admin/advanced');
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
