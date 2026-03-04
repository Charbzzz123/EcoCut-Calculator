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
import type { ClientSummary } from '../home/services/entry-repository.service.js';
import { EntryRepositoryService } from '../home/services/entry-repository.service.js';

type LoadState = 'loading' | 'ready' | 'error';

const createClientSignals = () => {
  return {
    clients: signal<ClientSummary[]>([]),
    state: signal<LoadState>('loading'),
    query: signal(''),
  };
};

@Component({
  standalone: true,
  selector: 'app-clients-shell',
  templateUrl: './clients-shell.component.html',
  styleUrls: ['./clients-shell.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsShellComponent implements OnInit, OnDestroy {
  private readonly repository = inject(EntryRepositoryService);
  private readonly queryControl = new FormControl('', { nonNullable: true });
  private readonly subscriptions = new Subscription();

  private readonly clientsSignal: WritableSignal<ClientSummary[]>;
  private readonly stateSignal: WritableSignal<LoadState>;
  private readonly querySignal: WritableSignal<string>;

  readonly headingId = 'client-roster-heading';

  readonly loadState: Signal<LoadState>;
  readonly query = this.queryControl;

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
    const term = this.querySignal().trim().toLowerCase();
    const clients = this.clientsSignal();
    if (!term) {
      return clients;
    }
    return clients.filter((client) => {
      return (
        client.fullName.toLowerCase().includes(term) ||
        client.address.toLowerCase().includes(term) ||
        client.phone.toLowerCase().includes(term) ||
        (client.email?.toLowerCase().includes(term) ?? false)
      );
    });
  }
}
