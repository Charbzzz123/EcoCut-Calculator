import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HomeFacade } from './home.facade';
import { HomeDataService } from './home-data.service';

class RouterStub {
  lastUrl: string | null = null;

  navigateByUrl(url: string) {
    this.lastUrl = url;
    return Promise.resolve(true);
  }
}

describe('HomeFacade', () => {
  let facade: HomeFacade;
  let router: RouterStub;

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

  it('should expose hero metrics data', () => {
    expect(facade.heroMetrics().length).toBeGreaterThan(0);
  });

  it('should delegate quick actions to navigation helpers', async () => {
    facade.handleQuickAction('new-job');

    expect(router.lastUrl).toBe('/jobs/new');
  });
});
