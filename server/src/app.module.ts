import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CalendarModule } from './calendar/calendar.module';

@Module({
  imports: [CalendarModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
