import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { EntryTimelineComponent, TimelineSelectionStyle } from './entry-timeline.component.js';
import type { TimelineEventBlock } from '../entry-modal.component.js';

describe('EntryTimelineComponent', () => {
  let fixture: ComponentFixture<EntryTimelineComponent>;
  let component: EntryTimelineComponent;

  const events: TimelineEventBlock[] = [
    {
      id: 'evt-1',
      summary: 'Morning job',
      location: '123 Pine',
      topPercent: 10,
      heightPercent: 15,
      leftPercent: 0,
      widthPercent: 100,
      column: 0,
      columns: 1,
      startMinutes: 8 * 60,
      endMinutes: 9 * 60,
    },
  ];

  const selection: TimelineSelectionStyle = {
    topPercent: 30,
    heightPercent: 20,
    conflict: false,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntryTimelineComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EntryTimelineComponent);
    component = fixture.componentInstance;
    component.hours = [7, 8, 9, 10];
    component.events = events;
    component.selectionStyle = selection;
    component.nowLine = { topPercent: 50 };
    component.helperText = 'Drag to pick a slot.';
  });

  it('renders timeline hours, events, and helper text', () => {
    fixture.detectChanges();
    const hours = fixture.nativeElement.querySelectorAll('.timeline-hour');
    expect(hours.length).toBe(4);
    expect(fixture.nativeElement.textContent).toContain('Morning job');
    expect(fixture.nativeElement.textContent).toContain('Drag to pick a slot.');
  });

  it('emits pointer events and exposes grid reference', () => {
    const pointerSpy = vi.fn();
    const gridSpy = vi.fn();
    component.timelinePointerDown.subscribe(pointerSpy);
    component.gridReady.subscribe(gridSpy);
    fixture.detectChanges();

    const grid = fixture.nativeElement.querySelector('.timeline-grid') as HTMLElement;
    const event =
      typeof PointerEvent === 'function'
        ? new PointerEvent('pointerdown')
        : (new MouseEvent('pointerdown') as unknown as PointerEvent);
    grid.dispatchEvent(event);
    expect(pointerSpy).toHaveBeenCalledWith(event);
    expect(gridSpy).toHaveBeenCalledTimes(1);
  });
});
