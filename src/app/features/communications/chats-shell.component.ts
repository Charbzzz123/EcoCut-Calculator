import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import type { ChatConversationSummary, ChatMessageView } from '@shared/domain/communications/chats-api.service.js';
import { BackChipComponent } from '@shared/ui/back-chip/back-chip.component.js';
import { BrandBannerComponent } from '@shared/ui/brand-banner/brand-banner.component.js';
import { ChatsFacade } from './chats.facade.js';

@Component({
  standalone: true,
  selector: 'app-chats-shell',
  imports: [CommonModule, ReactiveFormsModule, BrandBannerComponent, BackChipComponent],
  templateUrl: './chats-shell.component.html',
  styleUrl: './chats-shell.component.scss',
  providers: [ChatsFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatsShellComponent implements OnInit {
  protected readonly facade = inject(ChatsFacade);
  protected readonly headingId = 'chats-heading';

  ngOnInit(): void {
    void this.facade.init();
  }

  protected conversationTitle(conversation: ChatConversationSummary | null): string {
    return conversation?.displayName ?? conversation?.participantPhone ?? 'Unknown contact';
  }

  protected conversationSubtitle(conversation: ChatConversationSummary): string {
    return conversation.participantPhone ?? 'No phone number';
  }

  protected messageBody(message: ChatMessageView): string {
    return message.content?.trim() || '(No message content)';
  }

  protected selectConversation(conversation: ChatConversationSummary): void {
    void this.facade.selectConversation(conversation.conversationId);
  }

  protected syncChats(): void {
    void this.facade.syncChats();
  }

  protected sendMessage(): void {
    void this.facade.sendMessage();
  }
}
