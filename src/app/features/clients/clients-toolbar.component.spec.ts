import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { vi } from 'vitest';
import { ClientsToolbarComponent } from './clients-toolbar.component.js';

describe('ClientsToolbarComponent', () => {
  let fixture: ComponentFixture<ClientsToolbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientsToolbarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientsToolbarComponent);
    fixture.componentRef.setInput('queryControl', new FormControl('', { nonNullable: true }));
    fixture.detectChanges();
  });

  it('forwards refresh clicks', () => {
    const spy = vi.fn();
    fixture.componentInstance.refresh.subscribe(spy);
    const button = fixture.nativeElement.querySelector('.refresh-btn') as HTMLButtonElement;
    button.click();
    expect(spy).toHaveBeenCalled();
  });

  it('binds the query control', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'alex';
    input.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.queryControl.value).toBe('alex');
  });
});
