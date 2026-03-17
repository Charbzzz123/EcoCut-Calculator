import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type { Transporter } from 'nodemailer';
import { loadHostingerSmtpConfig } from '../communications.config';
import type { EmailMessagePayload } from '../communications.types';
import type { EmailProvider } from './email-provider';

@Injectable()
export class HostingerEmailProvider implements EmailProvider {
  private readonly logger = new Logger(HostingerEmailProvider.name);
  private readonly transporter: Transporter<SMTPTransport.SentMessageInfo> | null;
  private readonly from: string | null;

  constructor() {
    const config = loadHostingerSmtpConfig();
    if (!config) {
      this.transporter = null;
      this.from = null;
      this.logger.warn(
        'SMTP provider disabled: missing SMTP_HOST/SMTP_PORT/SMTP_USERNAME/SMTP_PASSWORD/SMTP_FROM.',
      );
      return;
    }
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password,
      },
    });
    this.from = config.from;
  }

  async send(message: EmailMessagePayload): Promise<string> {
    if (!this.transporter || !this.from) {
      throw new ServiceUnavailableException(
        'Email transport is not configured. Set SMTP_* environment variables.',
      );
    }
    const result: SMTPTransport.SentMessageInfo =
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.body,
      });
    return result.messageId ?? `${Date.now()}`;
  }
}
