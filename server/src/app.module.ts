import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CalendarModule } from './calendar/calendar.module';
import { CommunicationsModule } from './communications/communications.module';
import { EntriesModule } from './entries/entries.module';

@Module({
  imports: [CalendarModule, EntriesModule, CommunicationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
