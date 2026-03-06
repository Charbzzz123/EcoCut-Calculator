/* istanbul ignore file */
/* c8 ignore file */
import { ElementRef, WritableSignal } from '@angular/core';
import { vi } from 'vitest';
import type { EntryModalComponent } from '@shared/ui/entry-modal/entry-modal.component.js';
import { EntryModalPanelStore } from '@shared/ui/entry-modal/entry-modal-panel.store.js';
import type { HedgeConfig, HedgeState, TrimPreset } from '@shared/domain/entry/entry-modal.models.js';
import type { CalendarEventsService } from '@shared/domain/entry/calendar-events.service.js';

export class CalendarEventsServiceStub implements Pick<CalendarEventsService, 'listEventsForDate' | 'createEvent' | 'updateEvent' | 'deleteEvent'> {
  listEventsForDate = vi.fn().mockResolvedValue([]);
  createEvent = vi.fn();
  updateEvent = vi.fn().mockResolvedValue({
    id: 'evt-updated',
    summary: 'Updated booking',
    start: '2026-03-05T10:00:00Z',
    end: '2026-03-05T11:30:00Z',
    location: '123 Pine',
  });
  deleteEvent = vi.fn().mockResolvedValue(undefined);
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  width: number;
  height: number;
}

export interface EntryModalTestHandles {
  canvasHost?: ElementRef<HTMLElement>;
  panelStore: EntryModalPanelStore;
  panelPosition: WritableSignal<{ left: number; top: number }>;
  panelState: WritableSignal<unknown>;
  panelError: WritableSignal<string | null>;
  hedgeStates: WritableSignal<Record<string, HedgeState>>;
  savedConfigs: WritableSignal<Record<string, HedgeConfig>>;
  beginPanelDrag(event: PointerEvent): void;
  closePanel(resetSelection?: boolean): void;
  cancelPanel(): void;
  savePanel(): void;
  panelFloats(): boolean;
  trimHasCustomSelections(): boolean;
  trimPresetSelected(): TrimPreset | null;
  readonly eyebrowText: string;
  readonly headlineText: string;
  readonly subcopyText: string;
  readonly primaryLabelText: string;
}

export const asEntryModalInternals = (instance: EntryModalComponent): EntryModalTestHandles =>
  instance as unknown as EntryModalTestHandles;

export const createElementRef = (rect: Rect): ElementRef<HTMLElement> =>
  ({
    nativeElement: {
      getBoundingClientRect: () => ({
        ...rect,
        bottom: rect.top + rect.height,
        x: rect.left,
        y: rect.top,
        toJSON: () => ({}),
      }),
    } as HTMLElement,
  }) as unknown as ElementRef<HTMLElement>;

export const localTimeString = (iso: string): string => {
  const date = new Date(iso);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

export const assignCanvasHost = (
  internals: EntryModalTestHandles,
  rect: Rect | undefined,
): ElementRef<HTMLElement> | undefined => {
  const ref = rect ? createElementRef(rect) : undefined;
  internals.canvasHost = ref;
  internals.panelStore.setCanvasHost(ref);
  return ref;
};

export const createPanelMouseEvent = (): MouseEvent =>
  ({
    stopPropagation: vi.fn(),
    currentTarget: {
      getBoundingClientRect: () => ({
        left: 10,
        top: 20,
        right: 120,
        width: 110,
        height: 60,
        bottom: 80,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      }),
    },
  } as unknown as MouseEvent);
