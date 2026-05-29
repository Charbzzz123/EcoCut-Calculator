import { TestBed } from '@angular/core/testing';
import type { HeroMetric } from '../../../home.models.js';
import { MetricCardComponent } from './metric-card.component.js';

describe('MetricCardComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MetricCardComponent],
    });
  });

  function createComponent(metricOverrides: Partial<HeroMetric> = {}) {
    const fixture = TestBed.createComponent(MetricCardComponent);
    const component = fixture.componentInstance;
    component.metric = {
      id: 'metric',
      label: 'Metric',
      value: '0',
      ...metricOverrides,
    };
    fixture.detectChanges();
    return { fixture, component };
  }

  it('shows upward trend icon with delta label', () => {
    const { fixture } = createComponent({ trend: 'up', deltaLabel: '+2 jobs' });
    const deltaText = fixture.nativeElement.querySelector('.metric-delta').textContent.trim();
    expect(deltaText).toContain('▲');
    expect(deltaText).toContain('+2 jobs');
  });

  it('shows downward trend icon', () => {
    const { fixture } = createComponent({ trend: 'down', deltaLabel: '-$300' });
    expect(fixture.nativeElement.querySelector('.metric-delta').textContent).toContain('▼');
  });

  it('defaults to neutral icon when no trend provided', () => {
    const { fixture } = createComponent({ deltaLabel: 'steady' });
    expect(fixture.nativeElement.querySelector('.metric-delta').textContent).toContain('→');
  });
});
