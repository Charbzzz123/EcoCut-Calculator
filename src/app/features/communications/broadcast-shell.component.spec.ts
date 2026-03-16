import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BroadcastShellComponent } from './broadcast-shell.component.js';

describe('BroadcastShellComponent', () => {
  let fixture: ComponentFixture<BroadcastShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BroadcastShellComponent, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(BroadcastShellComponent);
    fixture.detectChanges();
  });

  it('renders the broadcast heading and summary metrics', () => {
    const heading = fixture.nativeElement.querySelector('h1');
    const cards = fixture.nativeElement.querySelectorAll('.summary-card');

    expect(heading?.textContent).toContain('Client broadcast');
    expect(cards.length).toBe(4);
  });

  it('renders a back chip to dashboard and setup panels', () => {
    const backChipLink = fixture.nativeElement.querySelector('a.back-chip') as HTMLAnchorElement;
    const boardCards = fixture.nativeElement.querySelectorAll('.board-card');

    expect(backChipLink.getAttribute('href')).toContain('/home');
    expect(boardCards.length).toBe(2);
  });
});
