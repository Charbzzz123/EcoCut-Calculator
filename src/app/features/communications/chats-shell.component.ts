import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BackChipComponent } from '@shared/ui/back-chip/back-chip.component.js';
import { BrandBannerComponent } from '@shared/ui/brand-banner/brand-banner.component.js';

interface ChatLaunchCard {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}

@Component({
  standalone: true,
  selector: 'app-chats-shell',
  imports: [CommonModule, BrandBannerComponent, BackChipComponent],
  templateUrl: './chats-shell.component.html',
  styleUrl: './chats-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatsShellComponent {
  protected readonly headingId = 'chats-heading';
  protected readonly launchCards: ChatLaunchCard[] = [
    {
      label: 'Mirror status',
      value: 'Ready',
      hint: 'Quo conversations and messages are persisted by the backend mirror.',
    },
    {
      label: 'Client links',
      value: 'Synced',
      hint: 'Client creates and edits now keep Quo contact links warm.',
    },
    {
      label: 'Next slice',
      value: 'Inbox UI',
      hint: 'Conversation list, thread view, and composer ship in CH-8.',
    },
  ];
}
