import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ChatsShellComponent } from './chats-shell.component.js';

describe('ChatsShellComponent', () => {
  let fixture: ComponentFixture<ChatsShellComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ChatsShellComponent, RouterTestingModule],
    });
    fixture = TestBed.createComponent(ChatsShellComponent);
    fixture.detectChanges();
  });

  it('renders the Chats route shell and launch status cards', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent?.trim()).toBe('Chats');
    expect(compiled.textContent).toContain('Mirror status');
    expect(compiled.textContent).toContain('Client links');
    expect(compiled.textContent).toContain('Inbox UI');
  });

  it('provides a dashboard back link', () => {
    const link = fixture.nativeElement.querySelector('app-back-chip a') as HTMLAnchorElement;

    expect(link.getAttribute('href')).toBe('/home');
    expect(link.textContent).toContain('Back to dashboard');
  });
});
