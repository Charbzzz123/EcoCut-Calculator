import { TestBed } from '@angular/core/testing';
import { type Event, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { AppComponent } from './app.component.js';

describe('AppComponent', () => {
  let routerEvents$: Subject<Event>;

  beforeEach(async () => {
    routerEvents$ = new Subject<Event>();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        {
          provide: Router,
          useValue: {
            events: routerEvents$.asObservable(),
          } satisfies Pick<Router, 'events'>,
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the shell wrapper', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-shell')).not.toBeNull();
  });

  it('toggles route transition state on navigation events', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & {
      routeTransitionActive: () => boolean;
    };

    expect(component.routeTransitionActive()).toBe(false);

    routerEvents$.next(new NavigationEnd(1, '/clients', '/clients'));
    expect(component.routeTransitionActive()).toBe(true);

    vi.advanceTimersByTime(360);
    expect(component.routeTransitionActive()).toBe(false);
  });

  it('restarts transition timer when navigation occurs again before timeout', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & {
      routeTransitionActive: () => boolean;
    };

    routerEvents$.next(new NavigationEnd(1, '/clients', '/clients'));
    vi.advanceTimersByTime(200);
    routerEvents$.next(new NavigationEnd(2, '/jobs', '/jobs'));

    vi.advanceTimersByTime(200);
    expect(component.routeTransitionActive()).toBe(true);

    vi.advanceTimersByTime(160);
    expect(component.routeTransitionActive()).toBe(false);
  });

  it('does not react to non-navigation events', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & {
      routeTransitionActive: () => boolean;
    };

    routerEvents$.next(new NavigationStart(1, '/noop'));
    expect(component.routeTransitionActive()).toBe(false);
  });

  it('clears pending transition timer when component is destroyed', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance as AppComponent & {
      routeTransitionActive: () => boolean;
    };

    routerEvents$.next(new NavigationEnd(1, '/clients', '/clients'));
    expect(component.routeTransitionActive()).toBe(true);

    fixture.destroy();
    vi.advanceTimersByTime(500);
    expect(component.routeTransitionActive()).toBe(true);
  });

  it('handles destroy with no active timer', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(() => fixture.destroy()).not.toThrow();
  });
});
