import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CalendarModule } from './calendar/calendar.module';
import { EntriesModule } from './entries/entries.module';

@Module({
  imports: [CalendarModule, EntriesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
