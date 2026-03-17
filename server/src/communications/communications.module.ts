import { Module } from '@nestjs/common';
import { CommunicationsController } from './communications.controller';
import { CommunicationsRepository } from './communications.repository';
import { CommunicationsService } from './communications.service';
import { EMAIL_PROVIDER } from './providers/email-provider';
import { HostingerEmailProvider } from './providers/hostinger-email.provider';
import { QuoSmsProvider } from './providers/quo-sms.provider';
import { SMS_PROVIDER } from './providers/sms-provider';

@Module({
  controllers: [CommunicationsController],
  providers: [
    CommunicationsRepository,
    CommunicationsService,
    { provide: EMAIL_PROVIDER, useClass: HostingerEmailProvider },
    { provide: SMS_PROVIDER, useClass: QuoSmsProvider },
  ],
})
export class CommunicationsModule {}
