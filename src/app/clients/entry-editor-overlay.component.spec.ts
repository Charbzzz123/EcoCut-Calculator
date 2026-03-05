import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { EntryEditorOverlayComponent } from './entry-editor-overlay.component.js';
import type { EntryModalPayload } from '../home/models/entry-modal.models.js';
import { createEmptyHedgeConfigs } from '../home/models/entry-modal.models.js';

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
    const spy = vi.fn();
    fixture.componentInstance.closed.subscribe(spy);
    const backdrop = fixture.nativeElement.querySelector('.entry-editor-backdrop') as HTMLDivElement;
    backdrop.click();
    expect(spy).toHaveBeenCalled();
  });

  it('re-emits save events', () => {
    const spy = vi.fn();
    fixture.componentInstance.saved.subscribe(spy);
    const modalRef = fixture.debugElement.query(By.css('app-entry-modal'));
    modalRef.componentInstance.saved.emit(payload);
    expect(spy).toHaveBeenCalledWith(payload);
  });
});
