import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { CommunicationsChatsService } from './chats/communications-chats.service';
import type {
  DeliveryProvider,
  DeliveryWebhookDto,
  DispatchBroadcastDto,
  SendBroadcastTestDto,
  UpsertSuppressionDto,
} from './communications.types';
import type {
  LinkClientContactDto,
  ListChatConversationsRequest,
  ListChatMessagesRequest,
  ListUnlinkedChatConversationsRequest,
  MarkConversationReadDto,
  QuoChatSyncRequest,
  ResolveUnlinkedConversationDto,
  SendChatMessageDto,
  SyncChatClientContactDto,
} from './chats/quo-chat.types';

@Controller('communications')
export class CommunicationsController {
  constructor(
    private readonly communications: CommunicationsService,
    private readonly chats: CommunicationsChatsService,
  ) {}

  @Post('test')
  sendTest(@Body() body: SendBroadcastTestDto) {
    return this.communications.sendTest(body);
  }

  @Post('dispatch')
  dispatch(@Body() body: DispatchBroadcastDto) {
    return this.communications.dispatch(body);
  }

  @Get('campaigns')
  listCampaigns() {
    return this.communications.listCampaigns();
  }

  @Get('campaigns/:campaignId')
  getCampaign(@Param('campaignId') campaignId: string) {
    return this.communications.getCampaign(campaignId);
  }

  @Get('campaigns/:campaignId/analytics')
  getCampaignAnalytics(@Param('campaignId') campaignId: string) {
    return this.communications.getCampaignAnalytics(campaignId);
  }

  @Get('campaigns/:campaignId/audit')
  listCampaignAudit(@Param('campaignId') campaignId: string) {
    return this.communications.listCampaignAudit(campaignId);
  }

  @Post('campaigns/:campaignId/approve')
  approveCampaign(
    @Param('campaignId') campaignId: string,
    @Body() body: { approvedBy?: 'owner' | 'manager' } = {},
  ) {
    return this.communications.approveCampaign(campaignId, body.approvedBy);
  }

  @Post('campaigns/:campaignId/cancel')
  cancelCampaign(
    @Param('campaignId') campaignId: string,
    @Body() body: { reason?: string } = {},
  ) {
    return this.communications.cancelCampaign(campaignId, body.reason);
  }

  @Post('webhooks/delivery')
  ingestDeliveryWebhook(@Body() body: DeliveryWebhookDto) {
    return this.communications.ingestDeliveryWebhook(body);
  }

  @Post('webhooks/delivery/:provider')
  ingestProviderWebhook(
    @Param('provider') provider: DeliveryProvider,
    @Headers('x-webhook-signature') signature: string | undefined,
    @Body() body: unknown,
  ) {
    return this.communications.ingestProviderWebhook(provider, body, signature);
  }

  @Get('suppressions')
  listSuppressions() {
    return this.communications.listSuppressions();
  }

  @Post('suppressions/unsubscribe')
  unsubscribe(@Body() body: UpsertSuppressionDto) {
    return this.communications.upsertSuppressions(body);
  }

  @Post('suppressions/resubscribe')
  resubscribe(@Body() body: UpsertSuppressionDto) {
    return this.communications.removeSuppressions(body);
  }

  @Get('chats/health')
  getChatsHealth() {
    return this.chats.getProviderHealth();
  }

  @Post('chats/sync')
  syncChats(@Body() body: QuoChatSyncRequest = {}) {
    return this.chats.syncMirror(body);
  }

  @Post('chats/webhooks/quo')
  ingestQuoChatWebhook(
    @Headers('x-webhook-signature') signature: string | undefined,
    @Body() body: unknown,
  ) {
    return this.chats.ingestQuoWebhook(body, signature);
  }

  @Get('chats/conversations')
  listChatConversations(@Query() query: ListChatConversationsRequest) {
    return this.chats.listConversations(this.normalizeConversationQuery(query));
  }

  @Get('chats/search')
  searchChatConversations(@Query() query: ListChatConversationsRequest) {
    return this.chats.searchConversations(
      this.normalizeConversationQuery(query),
    );
  }

  @Get('chats/conversations/:conversationId/messages')
  listChatMessages(
    @Param('conversationId') conversationId: string,
    @Query() query: ListChatMessagesRequest,
  ) {
    return this.chats.listConversationMessages(
      conversationId,
      this.normalizeMessageQuery(query),
    );
  }

  @Post('chats/conversations/:conversationId/messages')
  sendChatMessage(
    @Param('conversationId') conversationId: string,
    @Body() body: SendChatMessageDto,
  ) {
    return this.chats.sendMessage(conversationId, body);
  }

  @Post('chats/conversations/:conversationId/read')
  markChatConversationRead(
    @Param('conversationId') conversationId: string,
    @Body() body: MarkConversationReadDto = {},
  ) {
    return this.chats.markConversationRead(conversationId, body);
  }

  @Post('chats/clients/sync')
  syncChatClientContact(@Body() body: SyncChatClientContactDto) {
    return this.chats.syncClientContact(body);
  }

  @Get('chats/links')
  listChatClientLinks() {
    return this.chats.listClientContactLinks();
  }

  @Get('chats/links/:clientId')
  getChatClientLink(@Param('clientId') clientId: string) {
    return this.chats.getClientContactLink(clientId);
  }

  @Post('chats/links/:clientId')
  linkChatClientContact(
    @Param('clientId') clientId: string,
    @Body() body: LinkClientContactDto,
  ) {
    return this.chats.linkClientToContact(clientId, body);
  }

  @Delete('chats/links/:clientId')
  unlinkChatClientContact(@Param('clientId') clientId: string) {
    return this.chats.unlinkClientContact(clientId);
  }

  @Get('chats/conversations/unlinked')
  listUnlinkedChatConversations(
    @Query() query: ListUnlinkedChatConversationsRequest,
  ) {
    return this.chats.listUnlinkedConversations(
      this.normalizeConversationQuery(query),
    );
  }

  @Post('chats/conversations/:conversationId/resolve')
  resolveUnlinkedChatConversation(
    @Param('conversationId') conversationId: string,
    @Body() body: ResolveUnlinkedConversationDto,
  ) {
    return this.chats.resolveUnlinkedConversation(conversationId, body);
  }

  private normalizeConversationQuery(
    query: ListChatConversationsRequest | ListUnlinkedChatConversationsRequest,
  ): ListChatConversationsRequest {
    return {
      query: query.query,
      limit: this.parseOptionalNumber(query.limit),
      offset: this.parseOptionalNumber(query.offset),
    };
  }

  private normalizeMessageQuery(
    query: ListChatMessagesRequest,
  ): ListChatMessagesRequest {
    return {
      limit: this.parseOptionalNumber(query.limit),
      offset: this.parseOptionalNumber(query.offset),
    };
  }

  private parseOptionalNumber(
    value: number | string | undefined,
  ): number | undefined {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }
}
