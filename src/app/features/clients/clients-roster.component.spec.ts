import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ClientsRosterComponent } from './clients-roster.component.js';
import type { ClientSummary } from '@shared/domain/entry/entry-repository.service.js';

const clients: ClientSummary[] = [
  {
    clientId: '1',
    firstName: 'Alex',
    lastName: 'Stone',
    fullName: 'Alex Stone',
    address: '123 Pine',
    phone: '555-1111',
    jobsCount: 2,
    email: 'alex@example.com',
    lastJobDate: '2026-03-01T12:00:00Z',
    nextJobDate: '2026-03-05T12:00:00Z',
  },
];

describe('ClientsRosterComponent', () => {
  let fixture: ComponentFixture<ClientsRosterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientsRosterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientsRosterComponent);
    fixture.componentRef.setInput('loadState', 'ready');
    fixture.componentRef.setInput('clients', clients);
    fixture.componentRef.setInput('trackByClient', (_: number, client: ClientSummary) => client.clientId);
    fixture.detectChanges();
  });

  it('emits selection when clicking a card', () => {
    const spy = vi.fn();
    fixture.componentInstance.selectClient.subscribe(spy);
    const card = fixture.nativeElement.querySelector('.client-card') as HTMLButtonElement;
    card.click();
    expect(spy).toHaveBeenCalledWith(clients[0]);
  });

  it('shows error state and reload button', () => {
    fixture.componentRef.setInput('loadState', 'error');
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.reload.subscribe(spy);
    const button = fixture.nativeElement.querySelector('.clients-roster__state--error button') as HTMLButtonElement;
    button.click();
    expect(spy).toHaveBeenCalled();
  });

  it('shows empty state when no clients exist', () => {
    fixture.componentRef.setInput('clients', []);
    fixture.detectChanges();
    const empty = fixture.nativeElement.querySelector('.clients-roster__state--empty');
    expect(empty?.textContent).toContain('No clients match');
  });

  it('shows loading state copy', () => {
    fixture.componentRef.setInput('loadState', 'loading');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading client roster');
  });

  it('falls back to em dash when jobs are missing', () => {
    fixture.componentRef.setInput('clients', [
      {
        clientId: '2',
        firstName: 'Jamie',
        lastName: 'Lane',
        fullName: 'Jamie Lane',
        address: '42 Spruce',
        phone: '(438) 555-0000',
        jobsCount: 0,
        lastJobDate: null,
        nextJobDate: null,
      },
    ]);
    fixture.detectChanges();
    const metas = fixture.nativeElement.querySelectorAll('.client-card__meta strong');
    metas.forEach((el: HTMLElement) => expect(el.textContent?.trim()).toBe('—'));
  });
});
