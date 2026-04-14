import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import type { AddressSuggestion } from '@shared/domain/address/address-lookup.service.js';
import { AddressAutocompleteFieldComponent } from './address-autocomplete-field.component.js';

describe('AddressAutocompleteFieldComponent', () => {
  let fixture: ComponentFixture<AddressAutocompleteFieldComponent>;
  let component: AddressAutocompleteFieldComponent;

  const suggestion: AddressSuggestion = {
    id: 'addr-1',
    label: '109 57e Avenue, Saint-Eustache, QC J7P 3L5, Canada',
    primaryText: '109 57e Avenue',
    secondaryText: 'Saint-Eustache, QC J7P 3L5, Canada',
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [AddressAutocompleteFieldComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AddressAutocompleteFieldComponent);
    component = fixture.componentInstance;
    component.control = new FormControl('', { nonNullable: true });
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('emits focus and blur events from input', () => {
    const focusSpy = vi.fn();
    const blurSpy = vi.fn();
    component.focused.subscribe(focusSpy);
    component.blurred.subscribe(blurSpy);

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new Event('focus'));
    input.dispatchEvent(new Event('blur'));

    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(blurSpy).toHaveBeenCalledTimes(1);
  });

  it('renders suggestions and emits selected suggestion', () => {
    const selectedSpy = vi.fn();
    component.suggestionSelected.subscribe(selectedSpy);
    fixture.componentRef.setInput('showSuggestions', true);
    fixture.componentRef.setInput('suggestions', [suggestion]);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.address-suggestion') as HTMLButtonElement;
    expect(button.textContent).toContain('109 57e Avenue');
    button.click();

    expect(selectedSpy).toHaveBeenCalledWith(suggestion);
  });

  it('shows loading and empty states', () => {
    fixture.componentRef.setInput('showSuggestions', true);
    fixture.componentRef.setInput('loading', true);
    fixture.componentRef.setInput('searchStatusLabel', 'Searching...');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Searching...');

    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('suggestions', []);
    fixture.componentRef.setInput('emptyStatusLabel', 'No results');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No results');
  });

  it('keeps suggestion list rendered briefly while closing', () => {
    fixture.componentRef.setInput('showSuggestions', true);
    fixture.componentRef.setInput('suggestions', [suggestion]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.address-suggestions')).toBeTruthy();

    fixture.componentRef.setInput('showSuggestions', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.address-suggestions')).toBeTruthy();

    vi.advanceTimersByTime(180);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.address-suggestions')).toBeNull();
  });

  it('closes suggestions immediately when reduced motion is preferred', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn(
      () =>
        ({
          matches: true,
          media: '(prefers-reduced-motion: reduce)',
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList,
    );

    fixture.componentRef.setInput('showSuggestions', true);
    fixture.componentRef.setInput('suggestions', [suggestion]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.address-suggestions')).toBeTruthy();

    fixture.componentRef.setInput('showSuggestions', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.address-suggestions')).toBeNull();
    window.matchMedia = originalMatchMedia;
  });

  it('prevents default mousedown behavior on suggestions', () => {
    const event = {
      preventDefault: vi.fn(),
    } as unknown as MouseEvent;
    component['onSuggestionMouseDown'](event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('clears close timer when component is destroyed', () => {
    fixture.componentRef.setInput('showSuggestions', true);
    fixture.componentRef.setInput('suggestions', [suggestion]);
    fixture.detectChanges();
    fixture.componentRef.setInput('showSuggestions', false);
    fixture.detectChanges();
    expect(() => fixture.destroy()).not.toThrow();
  });
});
