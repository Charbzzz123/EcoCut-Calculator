import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { EntryModalFooterComponent } from './entry-modal-footer.component.js';

describe('EntryModalFooterComponent', () => {
  let fixture: ComponentFixture<EntryModalFooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntryModalFooterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EntryModalFooterComponent);
    fixture.componentRef.setInput('primaryLabel', 'Save Customer');
    fixture.componentRef.setInput('primaryDisabled', true);
    fixture.detectChanges();
  });

  it('emits cancel when requested', () => {
    const spy = vi.fn();
    fixture.componentInstance.dismiss.subscribe(spy);
    const cancelBtn = fixture.nativeElement.querySelector('button');
    cancelBtn.click();
    expect(spy).toHaveBeenCalled();
  });

  it('binds label and disabled state', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[1].textContent).toContain('Save Customer');
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
  });
});
