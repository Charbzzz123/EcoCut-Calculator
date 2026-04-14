import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { EntryEditorOverlayComponent } from './entry-editor-overlay.component.js';
import type { EntryModalPayload } from '@shared/domain/entry/entry-modal.models.js';
import { createEmptyHedgeConfigs } from '@shared/domain/entry/entry-modal.models.js';
import { CalendarEventsService } from '@shared/domain/entry/calendar-events.service.js';
import { CalendarEventsServiceStub } from '@shared/testing/entry-modal-test-helpers.js';

const payload: EntryModalPayload = {
  variant: 'customer',
  form: {
    firstName: 'Alex',
    lastName: 'Stone',
    address: '123 Pine',
    phone: '555-1111',
    jobType: 'Trim',
    jobValue: '$400',
  },
  hedges: createEmptyHedgeConfigs(),
};

describe('EntryEditorOverlayComponent', () => {
  let fixture: ComponentFixture<EntryEditorOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntryEditorOverlayComponent],
      providers: [{ provide: CalendarEventsService, useClass: CalendarEventsServiceStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(EntryEditorOverlayComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('variant', 'customer');
    fixture.componentRef.setInput('headline', 'Edit job');
    fixture.componentRef.setInput('eyebrow', 'Client job');
    fixture.componentRef.setInput('payload', payload);
    fixture.detectChanges();
  });

  it('emits closed when backdrop clicked', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    fixture.componentInstance.closed.subscribe(spy);
    const backdrop = fixture.nativeElement.querySelector('.entry-editor-backdrop') as HTMLDivElement;
    backdrop.click();
    vi.advanceTimersByTime(220);
    expect(spy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('re-emits save events', () => {
    vi.useFakeTimers();
    const closeSpy = vi.fn();
    const spy = vi.fn();
    fixture.componentInstance.closed.subscribe(closeSpy);
    fixture.componentInstance.saved.subscribe(spy);
    const modalRef = fixture.debugElement.query(By.css('app-entry-modal'));
    modalRef.componentInstance.closed.emit();
    vi.advanceTimersByTime(220);
    modalRef.componentInstance.saved.emit(payload);
    expect(closeSpy).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(payload);
    vi.useRealTimers();
  });

  it('ignores duplicate backdrop closes while closing state is active', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    fixture.componentInstance.closed.subscribe(spy);
    const backdrop = fixture.nativeElement.querySelector('.entry-editor-backdrop') as HTMLDivElement;
    backdrop.click();
    backdrop.click();
    vi.advanceTimersByTime(220);
    expect(spy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('clears pending close timer on destroy', () => {
    vi.useFakeTimers();
    const backdrop = fixture.nativeElement.querySelector('.entry-editor-backdrop') as HTMLDivElement;
    backdrop.click();
    expect(() => fixture.destroy()).not.toThrow();
    vi.useRealTimers();
  });
});
