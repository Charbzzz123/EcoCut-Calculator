import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { CalendarService } from './calendar.service.js';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto.js';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post('events')
  createEvent(@Body() body: CreateCalendarEventDto) {
    return this.calendarService.createEvent(body);
  }

  @Delete('events/:eventId')
  deleteEvent(@Param('eventId') eventId: string) {
    return this.calendarService.deleteEvent(eventId);
  }
}
