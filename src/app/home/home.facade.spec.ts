import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HomeFacade } from './home.facade';
import { HomeDataService } from './home-data.service';

class RouterStub {
  lastUrl: string | null = null;
  shouldReject = false;

  navigateByUrl(url: string) {
    this.lastUrl = url;
    if (this.shouldReject) {
      return Promise.reject(new Error('not ready'));
    }
    return Promise.resolve(true);
  }
}

describe('HomeFacade', () => {
  let facade: HomeFacade;
  let router: RouterStub;
  const originalInfo = console.info;
  const originalWarn = console.warn;

  beforeEach(() => {
    router = new RouterStub();

    TestBed.configureTestingModule({
      providers: [
        HomeFacade,
        HomeDataService,
        { provide: Router, useValue: router },
      ],
    });

    facade = TestBed.inject(HomeFacade);
  });

  afterEach(() => {
    console.info = originalInfo;
    console.warn = originalWarn;
  });

  it('should expose hero metrics data', () => {
    expect(facade.heroMetrics().length).toBeGreaterThan(0);
  });

  it('should expose supporting dashboard signals', () => {
    expect(facade.quickActions().length).toBeGreaterThan(0);
    expect(facade.recentJobs().length).toBeGreaterThan(0);
    expect(facade.alerts().length).toBeGreaterThan(0);
    expect(facade.weeklyPayroll().length).toBeGreaterThan(0);
    expect(facade.prfTrend().length).toBeGreaterThan(0);
    expect(facade.hasAlerts()).toBe(true);

    facade.updateAlerts([]);
    expect(facade.hasAlerts()).toBe(false);
  });

  it('should navigate when new job action is triggered', () => {
    facade.handleQuickAction('new-job');

    expect(router.lastUrl).toBe('/jobs/new');
  });

  it('should log when undo is triggered', () => {
    const logs: unknown[][] = [];
    console.info = (...args: unknown[]) => {
      logs.push(args);
    };

    facade.handleQuickAction('undo-job');

    expect(logs.length).toBe(1);
    expect((logs[0][0] as string).toString()).toContain('Undo last entry triggered');
  });

  it('should navigate to manage employees', () => {
    facade.handleQuickAction('manage-employees');

    expect(router.lastUrl).toBe('/admin/employees');
  });

  it('should navigate to advanced options', () => {
    facade.handleQuickAction('advanced-options');

    expect(router.lastUrl).toBe('/admin/advanced');
  });

  it('should warn when a command is unknown', () => {
    const warns: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      warns.push(args);
    };

    facade.handleQuickAction('unknown' as never);

    expect(warns.length).toBe(1);
    expect((warns[0][0] as string).toString()).toContain('Unhandled quick action');
  });

  it('should log navigation failures', async () => {
    router.shouldReject = true;
    const logs: unknown[][] = [];
    console.info = (...args: unknown[]) => {
      logs.push(args);
    };

    facade.openAdvancedOptions();
    await Promise.resolve();

    expect(logs.some((entry) => entry.join(' ').includes('not ready yet'))).toBe(true);
  });
});
