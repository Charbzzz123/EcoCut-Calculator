import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { EntryDetailsFormComponent, EntryDetailsFormHandlers } from './entry-details-form.component.js';
import { Component } from '@angular/core';
import { HedgeId, HedgeState } from '../../../models/entry-modal.models.js';

const HEDGE_IDS: HedgeId[] = ['hedge-1', 'hedge-2', 'hedge-3', 'hedge-4', 'hedge-5', 'hedge-6', 'hedge-7', 'hedge-8'];

const HEDGE_POINTS: Record<HedgeId, string> = HEDGE_IDS.reduce((acc, id, index) => {
  const offset = index * 10;
  acc[id] = `${offset},${offset} ${offset + 5},${offset} ${offset + 5},${offset + 5} ${offset},${offset + 5}`;
  return acc;
}, {} as Record<HedgeId, string>);

@Component({
  selector: 'app-entry-details-host',
  standalone: true,
  imports: [ReactiveFormsModule, EntryDetailsFormComponent],
  template: `
    <form [formGroup]="form">
      <app-entry-details-form
        [form]="form"
        [variant]="variant"
        [hedgeSelectionError]="hedgeError"
        [hedges]="hedges"
        [hedgePoints]="hedgePoints"
        [panelState]="panelState"
        [panelPosition]="panelPosition"
        [panelError]="panelError"
        [panelFloats]="panelFloats"
        [trimHasCustomSelections]="trimHasCustomSelections"
        [trimPresetSelected]="trimPresetSelected"
        [hasSavedConfig]="hasSavedConfig"
        [getHedgeState]="getHedgeState"
        [handlers]="handlers"
      ></app-entry-details-form>
    </form>
  `,
})
class EntryDetailsHostComponent {
  private readonly fb = new FormBuilder();
  form = this.fb.group({
    firstName: [''],
    lastName: [''],
    address: [''],
    phone: [''],
    email: [''],
    jobType: ['Hedge Trimming'],
    jobValue: [''],
    desiredBudget: [''],
    additionalDetails: [''],
  });
  variant: 'customer' | 'warm-lead' = 'customer';
  hedgeError: string | null = null;
  hedges: HedgeId[] = HEDGE_IDS;
  hedgePoints: Record<HedgeId, string> = HEDGE_POINTS;
  panelState = signal(null);
  panelPosition = signal({ left: 0, top: 0 });
  panelError = signal<string | null>(null);
  panelFloats = () => true;
  trimHasCustomSelections = () => false;
  trimPresetSelected = () => null;
  hasSavedConfig = () => false;
  getHedgeState = () => 'none' as HedgeState;
  handlers: EntryDetailsFormHandlers = {
    handlePhoneInput: vi.fn(),
    cycleHedge: vi.fn(),
    updateTrimSection: vi.fn(),
    selectTrimPreset: vi.fn(),
    selectRabattage: vi.fn(),
    updatePartialAmount: vi.fn(),
    savePanel: vi.fn(),
    cancelPanel: vi.fn(),
    beginPanelDrag: vi.fn(),
  };
}

describe('EntryDetailsFormComponent', () => {
  let fixture: ComponentFixture<EntryDetailsHostComponent>;
  let host: EntryDetailsHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntryDetailsHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(EntryDetailsHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders chip options and displays hedge error text', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(EntryDetailsHostComponent);
    host = fixture.componentInstance;
    host.hedgeError = 'Select at least one hedge';
    fixture.detectChanges();
    const chips = fixture.nativeElement.querySelectorAll('.chip');
    expect(chips.length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Select at least one hedge');
  });

  it('forwards phone input events to handler', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[formcontrolname="phone"]');
    input.value = '123';
    input.dispatchEvent(new Event('input'));
    expect(host.handlers.handlePhoneInput).toHaveBeenCalled();
  });

  it('emits hedge cycle events when a polygon is clicked', () => {
    const polygon: SVGElement = fixture.nativeElement.querySelector('polygon');
    polygon.dispatchEvent(new MouseEvent('click'));
    expect(host.handlers.cycleHedge).toHaveBeenCalled();
  });
});
