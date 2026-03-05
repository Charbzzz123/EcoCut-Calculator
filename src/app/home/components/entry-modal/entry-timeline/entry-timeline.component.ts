import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { TimelineEventBlock } from '../entry-modal.component.js';

export interface TimelineSelectionStyle {
  topPercent: number;
  heightPercent: number;
  conflict: boolean;
}

@Component({
  standalone: true,
  selector: 'app-entry-timeline',
  templateUrl: './entry-timeline.component.html',
  styleUrls: ['./entry-timeline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class EntryTimelineComponent implements AfterViewInit {
  @Input({ required: true }) hours: number[] = [];
  @Input() events: TimelineEventBlock[] = [];
  @Input() selectionStyle: TimelineSelectionStyle | null = null;
  @Input() nowLine: { topPercent: number } | null = null;
  @Input() helperText = '';
  @Output() timelinePointerDown = new EventEmitter<PointerEvent>();
  @Output() gridReady = new EventEmitter<ElementRef<HTMLElement>>();

  @ViewChild('timelineGrid', { static: true })
  private readonly timelineGrid?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    if (this.timelineGrid) {
      this.gridReady.emit(this.timelineGrid);
    }
  }

  protected handlePointerDown(event: PointerEvent): void {
    this.timelinePointerDown.emit(event);
  }

  protected hourPosition(index: number): number {
    if (this.hours.length <= 1) {
      return 0;
    }
    return (index / (this.hours.length - 1)) * 100;
  }

  protected formatTimelineHour(hour: number): string {
    const normalized = ((hour + 11) % 12) + 1;
    const suffix = hour < 12 ? 'AM' : 'PM';
    return `${normalized} ${suffix}`;
  }
}
