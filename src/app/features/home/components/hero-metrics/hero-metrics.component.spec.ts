import { TestBed } from '@angular/core/testing';
import { HeroMetricsComponent } from './hero-metrics.component.js';
import type { HeroMetric } from '../../home.models';

const metrics: HeroMetric[] = [
  { id: 'jobs', label: 'Jobs today', value: '4' },
  { id: 'gross', label: 'Gross', value: '$5,240', trend: 'up', deltaLabel: '+$320' },
];

describe('HeroMetricsComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HeroMetricsComponent],
    });
  });

  it('renders metric cards', () => {
    const fixture = TestBed.createComponent(HeroMetricsComponent);
    const component = fixture.componentInstance as HeroMetricsComponent;
    component.metrics = metrics;
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('app-metric-card');
    expect(cards.length).toBe(2);
  });

  it('renders empty state when no metrics', () => {
    const fixture = TestBed.createComponent(HeroMetricsComponent);
    const component = fixture.componentInstance as HeroMetricsComponent;
    component.metrics = [];
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.hero-metrics__empty').textContent.trim(),
    ).toContain('Add metrics');
  });
});
