import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FormControl } from '@angular/forms';
import { vi } from 'vitest';
import type { ClientDetail, ClientSummary } from '../home/services/entry-repository.service.js';
import { createEmptyHedgeConfigs } from '../home/models/entry-modal.models.js';
import type { EntryModalPayload } from '../home/models/entry-modal.models.js';
import { ClientsFacade } from './clients.facade.js';
import { ClientsShellComponent } from './clients-shell.component.js';
import { By } from '@angular/platform-browser';

const baseClients: ClientSummary[] = [
  {
    clientId: 'alex@example.com',
    firstName: 'Alex',
    lastName: 'Stone',
    fullName: 'Alex Stone',
    address: '123 Pine Ave',
    phone: '(438) 555-1111',
    email: 'alex@example.com',
    jobsCount: 2,
    lastJobDate: '2026-03-04T12:00:00Z',
    nextJobDate: '2026-03-10T12:00:00Z',
  },
];

const detail: ClientDetail = {
  ...baseClients[0],
  history: [
    {
      entryId: 'job-1',
      createdAt: '',
      variant: 'customer',
      jobType: 'Trim',
      jobValue: '$400',
      location: '',
      contactPhone: '',
      contactEmail: 'alex@example.com',
      desiredBudget: '$300',
      additionalDetails: 'Side yard only',
      calendar: {
        start: '2026-03-05T10:00:00Z',
        end: '2026-03-05T12:00:00Z',
        timeZone: 'America/Toronto',
      },
      hedges: createEmptyHedgeConfigs(),
      hedgePlan: ['Left Trim T'],
      form: {
        firstName: 'Alex',
        lastName: 'Stone',
        address: '123 Pine Ave',
        phone: '(438) 555-1111',
        email: 'alex@example.com',
        jobType: 'Trim',
        jobValue: '$400',
        desiredBudget: '$300',
        additionalDetails: 'Side yard only',
      },
    },
  ],
};

class ClientsFacadeStub {
  headingId = 'client-roster-heading';
  queryControl = new FormControl('', { nonNullable: true });
  loadClients = vi.fn(() => Promise.resolve());
  statsSnapshot = vi.fn(() => ({
    totalClients: baseClients.length,
    totalJobs: 2,
    mostRecentDate: baseClients[0].lastJobDate,
    nextJobDate: baseClients[0].nextJobDate,
  }));
  filteredClientsSnapshot = vi.fn(() => baseClients);
  trackByClientId = vi.fn((_: number, client: ClientSummary) => client.clientId);
  loadState = vi.fn(() => 'ready');
  private drawerVisibleSignal = signal(false);
  drawerVisible = this.drawerVisibleSignal.asReadonly();
  private activeClientSignal = signal<ClientSummary | null>(null);
  activeClient = this.activeClientSignal.asReadonly();
  private clientDetailSignal = signal<ClientDetail | null>(null);
  clientDetail = this.clientDetailSignal.asReadonly();
  private detailStateSignal = signal<'loading' | 'ready' | 'error'>('loading');
  detailState = this.detailStateSignal.asReadonly();
  reloadClientDetail = vi.fn();
  closeDrawer = vi.fn();
  handleClientUpdate = vi.fn();
  handleClientDelete = vi.fn();
  openClientDrawer = vi.fn();
  openEntryEditor = vi.fn();
  deleteHistoryEntry = vi.fn();
  private entryEditorOpenSignal = signal(false);
  entryEditorOpen = this.entryEditorOpenSignal.asReadonly();
  private entryEditorPayloadSignal = signal<EntryModalPayload | null>(null);
  entryEditorPayload = this.entryEditorPayloadSignal.asReadonly();
  private entryEditorVariantSignal = signal<'customer' | 'warm-lead'>('customer');
  entryEditorVariant = this.entryEditorVariantSignal.asReadonly();
  private entryEditorHeadlineSignal = signal('Edit job');
  entryEditorHeadline = this.entryEditorHeadlineSignal.asReadonly();
  private entryEditorEyebrowSignal = signal('Client job');
  entryEditorEyebrow = this.entryEditorEyebrowSignal.asReadonly();
  closeEntryEditor = vi.fn();
  handleEntryEditorSaved = vi.fn();

  setDrawerVisible(value: boolean): void {
    this.drawerVisibleSignal.set(value);
  }

  setActiveClient(value: ClientSummary | null): void {
    this.activeClientSignal.set(value);
  }

  setClientDetail(value: ClientDetail | null): void {
    this.clientDetailSignal.set(value);
  }

  setDetailState(value: 'loading' | 'ready' | 'error'): void {
    this.detailStateSignal.set(value);
  }

  setEntryEditor(options: {
    open?: boolean;
    payload?: EntryModalPayload | null;
    variant?: 'customer' | 'warm-lead';
    headline?: string;
    eyebrow?: string;
  }): void {
    if (options.open !== undefined) {
      this.entryEditorOpenSignal.set(options.open);
    }
    if (options.payload !== undefined) {
      this.entryEditorPayloadSignal.set(options.payload);
    }
    if (options.variant) {
      this.entryEditorVariantSignal.set(options.variant);
    }
    if (options.headline) {
      this.entryEditorHeadlineSignal.set(options.headline);
    }
    if (options.eyebrow) {
      this.entryEditorEyebrowSignal.set(options.eyebrow);
    }
  }
}

describe('ClientsShellComponent', () => {
  let fixture: ComponentFixture<ClientsShellComponent>;
  let facade: ClientsFacadeStub;

  beforeEach(async () => {
    facade = new ClientsFacadeStub();
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ClientsFacade, useValue: facade },
      ],
      imports: [ClientsShellComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientsShellComponent);
    fixture.detectChanges();
    fixture.detectChanges();
  });

  it('loads clients on init and refreshes via toolbar', () => {
    expect(facade.loadClients).toHaveBeenCalledTimes(1);
    const refresh = fixture.nativeElement.querySelector('.refresh-btn') as HTMLButtonElement;
    refresh.click();
    expect(facade.loadClients).toHaveBeenCalledTimes(2);
  });

  it('passes clients to the roster and handles selection events', () => {
    const card = fixture.nativeElement.querySelector('.client-card') as HTMLButtonElement;
    card.click();
    expect(facade.openClientDrawer).toHaveBeenCalledWith(baseClients[0]);

    const rosterDebug = fixture.debugElement.query(By.css('app-clients-roster'));
    expect(rosterDebug).toBeTruthy();
    expect(facade.loadClients).toHaveBeenCalledTimes(1);
    rosterDebug.componentInstance.reload.emit();
    expect(facade.loadClients).toHaveBeenCalledTimes(2);
  });

  it('renders the drawer overlay when visible and wires actions', () => {
    facade.setDrawerVisible(true);
    facade.setActiveClient(baseClients[0]);
    facade.setClientDetail(detail);
    facade.setDetailState('ready');
    fixture.detectChanges();
    const overlayDebug = fixture.debugElement.query(By.css('app-client-detail-overlay'));
    expect(overlayDebug).toBeTruthy();
    const overlay = overlayDebug!.nativeElement;
    const backdrop = overlay.querySelector('.client-detail-overlay__backdrop') as HTMLButtonElement;
    backdrop.click();
    expect(facade.closeDrawer).toHaveBeenCalled();
    const overlayCmp = overlayDebug!.componentInstance;
    overlayCmp.retry.emit();
    expect(facade.reloadClientDetail).toHaveBeenCalled();
    const updates = { firstName: 'Lex' };
    overlayCmp.updateClient.emit(updates);
    expect(facade.handleClientUpdate).toHaveBeenCalledWith(updates);
    overlayCmp.deleteClient.emit();
    expect(facade.handleClientDelete).toHaveBeenCalled();
    const history = detail.history[0]!;
    overlayCmp.editEntry.emit(history);
    expect(facade.openEntryEditor).toHaveBeenCalledWith(history);
    overlayCmp.deleteEntry.emit(history);
    expect(facade.deleteHistoryEntry).toHaveBeenCalledWith(history);
  });

  it('renders the entry editor overlay when open', () => {
    facade.setEntryEditor({
      open: true,
      payload: {
        variant: 'customer',
        form: detail.history[0]?.form,
        hedges: createEmptyHedgeConfigs(),
      },
    });
    fixture.detectChanges();
    const overlayDebug = fixture.debugElement.query(By.css('app-entry-editor-overlay'));
    expect(overlayDebug).toBeTruthy();
    const overlay = overlayDebug!.nativeElement;
    const backdrop = overlay.querySelector('.entry-editor-backdrop') as HTMLDivElement;
    backdrop.click();
    expect(facade.closeEntryEditor).toHaveBeenCalled();
    const payload = {
      variant: 'customer' as const,
      form: detail.history[0]!.form!,
      hedges: createEmptyHedgeConfigs(),
    };
    overlayDebug!.componentInstance.saved.emit(payload);
    expect(facade.handleEntryEditorSaved).toHaveBeenCalledWith(payload);
    overlayDebug!.componentInstance.closed.emit();
    expect(facade.closeEntryEditor).toHaveBeenCalledTimes(2);
  });

  it('shows summary fallback when there are no historic dates', () => {
    fixture.destroy();
    facade.statsSnapshot.mockReturnValue({
      totalClients: 0,
      totalJobs: 0,
      mostRecentDate: null,
      nextJobDate: null,
    });
    fixture = TestBed.createComponent(ClientsShellComponent);
    fixture.detectChanges();
    fixture.detectChanges();
    const values = Array.from(
      fixture.nativeElement.querySelectorAll('.summary-card__value') as NodeListOf<HTMLElement>,
    ).map((el) => el.textContent?.trim());
    expect(values[2]).toBe('—');
    expect(values[3]).toBe('—');
  });
});
