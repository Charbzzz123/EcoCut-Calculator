import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

const ROUTE_TRANSITION_MS = 360;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly routeTransitionActive = signal(false);

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.runRouteTransition());

    this.destroyRef.onDestroy(() => this.clearTransitionTimer());
  }

  private runRouteTransition(): void {
    this.routeTransitionActive.set(true);
    this.clearTransitionTimer();
    this.transitionTimer = setTimeout(() => {
      this.routeTransitionActive.set(false);
      this.transitionTimer = null;
    }, ROUTE_TRANSITION_MS);
  }

  private clearTransitionTimer(): void {
    if (this.transitionTimer !== null) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
  }
}
