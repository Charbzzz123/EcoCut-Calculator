import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import type {
  DispatchBroadcastDto,
  SendBroadcastTestDto,
  UpsertSuppressionDto,
} from './communications.types';

@Controller('communications')
export class CommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}

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
}
