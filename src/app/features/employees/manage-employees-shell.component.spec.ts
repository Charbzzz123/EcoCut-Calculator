import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ManageEmployeesShellComponent } from './manage-employees-shell.component.js';

describe('ManageEmployeesShellComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageEmployeesShellComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the hero header and roadmap slices', () => {
    const fixture = TestBed.createComponent(ManageEmployeesShellComponent);
    fixture.detectChanges();

    const native = fixture.nativeElement as HTMLElement;
    expect(native.querySelector('h1')?.textContent).toContain('Manage employees');
    expect(native.querySelectorAll('.slice-card')).toHaveLength(4);
  });
});
