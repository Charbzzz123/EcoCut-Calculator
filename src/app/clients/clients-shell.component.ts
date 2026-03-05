import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  Signal,
  WritableSignal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, startWith, Subscription } from 'rxjs';
import type { ClientDetail, ClientSummary } from '../home/services/entry-repository.service.js';
import { EntryRepositoryService } from '../home/services/entry-repository.service.js';
import { ClientDetailDrawerComponent, ClientDetailState } from './client-detail-drawer.component.js';

type LoadState = 'loading' | 'ready' | 'error';

const createClientSignals = () => {
  return {
    clients: signal<ClientSummary[]>([]),
    state: signal<LoadState>('loading'),
    query: signal(''),
  };
};

const digitsOnly = (value: string): string => value.replace(/\D/g, '');

@Component({
  standalone: true,
  selector: 'app-clients-shell',
  templateUrl: './clients-shell.component.html',
  styleUrls: ['./clients-shell.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ClientDetailDrawerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsShellComponent implements OnInit, OnDestroy {
  private readonly repository = inject(EntryRepositoryService);
  private readonly queryControl = new FormControl('', { nonNullable: true });
  private readonly subscriptions = new Subscription();

  private readonly clientsSignal: WritableSignal<ClientSummary[]>;
  private readonly stateSignal: WritableSignal<LoadState>;
  private readonly querySignal: WritableSignal<string>;
  private readonly activeClientSignal = signal<ClientSummary | null>(null);
  private readonly detailSignal = signal<ClientDetail | null>(null);
  private readonly detailStateSignal = signal<ClientDetailState>('loading');
  private detailRequestId = 0;

  readonly headingId = 'client-roster-heading';

  readonly loadState: Signal<LoadState>;
  readonly query = this.queryControl;
  readonly drawerVisible = computed(() => this.activeClientSignal() !== null);
  readonly activeClient = this.activeClientSignal.asReadonly();
  readonly clientDetail = this.detailSignal.asReadonly();
  readonly detailState = this.detailStateSignal.asReadonly();

  constructor() {
    const signals = createClientSignals();
    this.clientsSignal = signals.clients;
    this.stateSignal = signals.state;
    this.querySignal = signals.query;
    this.loadState = this.stateSignal.asReadonly();
  }

  ngOnInit(): void {
    this.loadClients();
    this.subscriptions.add(
      this.queryControl.valueChanges
        .pipe(startWith(this.queryControl.value), debounceTime(150), distinctUntilChanged())
        .subscribe((value) => this.querySignal.set(value)),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async loadClients(): Promise<void> {
    this.stateSignal.set('loading');
    try {
      const clients = await this.repository.listClients();
      this.clientsSignal.set(clients);
      this.stateSignal.set('ready');
    } catch (error) {
      console.warn('Failed to load clients roster', error);
      this.stateSignal.set('error');
    }
  }

  trackByClientId(_: number, client: ClientSummary): string {
    return client.clientId;
  }

  statsSnapshot(): { totalClients: number; totalJobs: number; mostRecentDate: string | null } {
    const clients = this.clientsSignal();
    const totalJobs = clients.reduce((acc, client) => acc + client.jobsCount, 0);
    const mostRecentDate = clients.reduce<string | null>((latest, client) => {
      if (!client.lastJobDate) {
        return latest;
      }
      if (!latest || client.lastJobDate > latest) {
        return client.lastJobDate;
      }
      return latest;
    }, null);
    return { totalClients: clients.length, totalJobs, mostRecentDate };
  }

  filteredClientsSnapshot(): ClientSummary[] {
    const rawTerm = this.querySignal().trim();
    const term = rawTerm.toLowerCase();
    const digitsTerm = digitsOnly(rawTerm);
    const clients = this.clientsSignal();
    if (!term) {
      return clients;
    }
    return clients.filter((client) => {
      const phoneDigits = digitsOnly(client.phone);
      const emailDigits = client.email ? digitsOnly(client.email) : '';
      return (
        client.fullName.toLowerCase().includes(term) ||
        client.address.toLowerCase().includes(term) ||
        client.phone.toLowerCase().includes(term) ||
        (client.email?.toLowerCase().includes(term) ?? false) ||
        (digitsTerm.length >= 3 && phoneDigits.includes(digitsTerm)) ||
        (digitsTerm.length >= 3 && emailDigits.includes(digitsTerm))
      );
    });
  }

  async openClientDrawer(client: ClientSummary): Promise<void> {
    this.activeClientSignal.set(client);
    await this.fetchClientDetail(client);
  }

  async reloadClientDetail(): Promise<void> {
    const active = this.activeClientSignal();
    if (!active) {
      return;
    }
    await this.fetchClientDetail(active);
  }

  closeDrawer(): void {
    this.activeClientSignal.set(null);
    this.detailSignal.set(null);
    this.detailStateSignal.set('loading');
  }

  private async fetchClientDetail(client: ClientSummary): Promise<void> {
    const requestId = ++this.detailRequestId;
    this.detailSignal.set(null);
    this.detailStateSignal.set('loading');
    try {
      const detail = await this.repository.getClientDetail(client.clientId);
      if (requestId !== this.detailRequestId) {
        return;
      }
      this.detailSignal.set(detail);
      this.detailStateSignal.set('ready');
    } catch (error) {
      console.warn('Failed to load client detail', error);
      if (requestId !== this.detailRequestId) {
        return;
      }
      this.detailStateSignal.set('error');
    }
  }
}
