import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { ChatConversationSummary, ChatMessageView } from '@shared/domain/communications/chats-api.service.js';
import { BackChipComponent } from '@shared/ui/back-chip/back-chip.component.js';
import { BrandBannerComponent } from '@shared/ui/brand-banner/brand-banner.component.js';
import { ChatsFacade } from './chats.facade.js';

@Component({
  standalone: true,
  selector: 'app-chats-shell',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BrandBannerComponent, BackChipComponent],
  templateUrl: './chats-shell.component.html',
  styleUrl: './chats-shell.component.scss',
  providers: [ChatsFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatsShellComponent implements OnInit, AfterViewChecked {
  @ViewChild('threadMessages') private threadMessages?: ElementRef<HTMLElement>;

  protected readonly facade = inject(ChatsFacade);
  protected readonly headingId = 'chats-heading';
  private lastThreadScrollKey = '';

  ngOnInit(): void {
    void this.facade.init();
  }

  ngAfterViewChecked(): void {
    const conversationId = this.facade.selectedConversationId() ?? '';
    const latestMessageId = this.facade.messages().at(-1)?.messageId ?? '';
    const scrollKey = `${conversationId}:${this.facade.messages().length}:${latestMessageId}`;
    if (scrollKey === this.lastThreadScrollKey) {
      return;
    }

    this.lastThreadScrollKey = scrollKey;
    this.scheduleThreadScrollToBottom();
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
    this.lastThreadScrollKey = '';
    void this.facade.selectConversation(conversation.conversationId).then(() => {
      this.scheduleThreadScrollToBottom();
    });
  }

  protected syncChats(): void {
    void this.facade.syncChats();
  }

  protected loadMoreConversations(): void {
    void this.facade.loadMoreConversations();
  }

  protected sendMessage(): void {
    void this.facade.sendMessage().then(() => {
      this.lastThreadScrollKey = '';
      this.scheduleThreadScrollToBottom();
    });
  }

  private scheduleThreadScrollToBottom(): void {
    const run = (callback: () => void) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(callback);
        return;
      }

      setTimeout(callback, 0);
    };

    run(() => {
      run(() => {
        const element = this.threadMessages?.nativeElement;
        if (element) {
          element.scrollTop = element.scrollHeight;
        }
      });
    });
  }
}
