import { Module } from '@nestjs/common';
import { AddressesModule } from './addresses/addresses.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CalendarModule } from './calendar/calendar.module';
import { CommunicationsModule } from './communications/communications.module';
import { EmployeesModule } from './employees/employees.module';
import { EntriesModule } from './entries/entries.module';

@Module({
  imports: [
    AddressesModule,
    CalendarModule,
    EntriesModule,
    CommunicationsModule,
    EmployeesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
