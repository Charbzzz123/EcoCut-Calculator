import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { vi } from 'vitest';
import { SelectDropdownComponent } from './select-dropdown.component.js';

describe('SelectDropdownComponent', () => {
  let fixture: ComponentFixture<SelectDropdownComponent>;
  let component: SelectDropdownComponent;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [SelectDropdownComponent, ReactiveFormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectDropdownComponent);
    component = fixture.componentInstance;
    component.ariaLabel = 'Test dropdown';
    component.options = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ];
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders current selection and updates value through CVA', () => {
    let changedValue = '';
    component.registerOnChange((value: string) => {
      changedValue = value;
    });
    component.writeValue('a');
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.select-dropdown__trigger') as HTMLButtonElement;
    expect(trigger.textContent).toContain('Alpha');

    trigger.click();
    fixture.detectChanges();
    const options = fixture.nativeElement.querySelectorAll('.select-dropdown__option') as NodeListOf<HTMLButtonElement>;
    options[1].click();
    fixture.detectChanges();
    vi.advanceTimersByTime(180);
    fixture.detectChanges();

    expect(changedValue).toBe('b');
    expect(fixture.nativeElement.querySelector('.select-dropdown__menu')).toBeNull();
  });

  it('closes menu on outside click and calls touched callback', () => {
    const touched = vi.fn();
    component.registerOnTouched(touched);

    const trigger = fixture.nativeElement.querySelector('.select-dropdown__trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.select-dropdown__menu')).toBeTruthy();

    component['onDocumentClick']({ target: document.createElement('div') } as unknown as MouseEvent);
    fixture.detectChanges();
    vi.advanceTimersByTime(180);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.select-dropdown__menu')).toBeNull();
    expect(touched).toHaveBeenCalledTimes(1);
  });

  it('shows empty label and disables trigger when there are no options', () => {
    component.options = [];
    component.emptyLabel = 'Nothing here';
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.select-dropdown__trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    expect(trigger.textContent).toContain('Nothing here');
    expect(fixture.nativeElement.querySelector('.select-dropdown__menu')).toBeNull();
  });

  it('keeps disabled option from being selected', () => {
    component.options = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta', disabled: true },
    ];
    component.writeValue('a');
    fixture.detectChanges();

    const onChange = vi.fn();
    component.registerOnChange(onChange);
    const trigger = fixture.nativeElement.querySelector('.select-dropdown__trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('.select-dropdown__option') as NodeListOf<HTMLButtonElement>;
    options[1].click();
    fixture.detectChanges();

    expect(onChange).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.select-dropdown__menu')).toBeTruthy();
  });

  it('falls back to first available option label for unknown value', () => {
    component.writeValue('missing');
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.select-dropdown__trigger') as HTMLButtonElement;
    expect(trigger.textContent).toContain('Alpha');
  });

  it('respects external disabled state', () => {
    component.setDisabledState(true);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.select-dropdown__trigger') as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
  });
});
