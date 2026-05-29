import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { BackChipComponent } from './back-chip.component.js';

describe('BackChipComponent', () => {
  let fixture: ComponentFixture<BackChipComponent>;
  let component: BackChipComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BackChipComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(BackChipComponent);
    component = fixture.componentInstance;
    component.label = 'Back home';
  });

  it('renders anchor when routerLink provided', () => {
    component.routerLink = ['/home'];
    const spy = vi.fn();
    component.back.subscribe(spy);
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('a.back-chip');
    expect(anchor).toBeTruthy();
    expect(anchor?.getAttribute('aria-label')).toBe('Back home');
    expect(anchor?.textContent?.trim()).toContain('Back home');
    anchor?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('renders button + emits when routerLink missing', () => {
    component.routerLink = undefined;
    const spy = vi.fn();
    component.back.subscribe(spy);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button.back-chip');
    expect(button).toBeTruthy();
    button.click();
    expect(spy).toHaveBeenCalled();
  });
});
