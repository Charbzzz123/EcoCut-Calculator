import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClientsToolbarComponent } from './clients-toolbar.component.js';
import { ClientsRosterComponent } from './clients-roster.component.js';
import { ClientDetailOverlayComponent } from './client-detail-overlay.component.js';
import { EntryEditorOverlayComponent } from './entry-editor-overlay.component.js';
import { ClientsFacade } from './clients.facade.js';

@Component({
  standalone: true,
  selector: 'app-clients-shell',
  templateUrl: './clients-shell.component.html',
  styleUrls: ['./clients-shell.component.scss'],
  imports: [
    CommonModule,
    RouterLink,
    ClientsToolbarComponent,
    ClientsRosterComponent,
    ClientDetailOverlayComponent,
    EntryEditorOverlayComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsShellComponent implements OnInit {
  protected readonly facade = inject(ClientsFacade);

  readonly headingId = this.facade.headingId;
  readonly queryControl = this.facade.queryControl;
  readonly drawerVisible = this.facade.drawerVisible;
  readonly activeClient = this.facade.activeClient;
  readonly clientDetail = this.facade.clientDetail;
  readonly detailState = this.facade.detailState;
  readonly entryEditorOpen = this.facade.entryEditorOpen;
  readonly entryEditorPayload = this.facade.entryEditorPayload;
  readonly entryEditorVariant = this.facade.entryEditorVariant;
  readonly entryEditorHeadline = this.facade.entryEditorHeadline;
  readonly entryEditorEyebrow = this.facade.entryEditorEyebrow;
  readonly loadState = this.facade.loadState;

  readonly statsSnapshot = () => this.facade.statsSnapshot();
  readonly filteredClientsSnapshot = () => this.facade.filteredClientsSnapshot();
  readonly trackByClientId = this.facade.trackByClientId;

  ngOnInit(): void {
    void this.facade.loadClients();
  }

  protected loadClients(): void {
    void this.facade.loadClients();
  }
}
