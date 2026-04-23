import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { CommunicationsChatsService } from './chats/communications-chats.service';
import type {
  DeliveryProvider,
  DeliveryWebhookDto,
  DispatchBroadcastDto,
  SendBroadcastTestDto,
  UpsertSuppressionDto,
} from './communications.types';
import type { QuoChatSyncRequest } from './chats/quo-chat.types';

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
}
